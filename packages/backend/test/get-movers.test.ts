describe('get-movers Lambda Handler', () => {
    let ddbMock: any;
    let QueryCommandClass: any;

    beforeEach(() => {
        jest.resetModules();

        const { mockClient } = require('aws-sdk-client-mock');
        const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
        ddbMock = mockClient(DynamoDBDocumentClient);
        QueryCommandClass = QueryCommand;

        process.env.AWS_ACCESS_KEY_ID = 'fake-access-key-id';
        process.env.AWS_SECRET_ACCESS_KEY = 'fake-secret-access-key';
        process.env.AWS_REGION = 'us-east-1';
        process.env.TABLE_NAME = 'TestTable';
    });

    it('should query DynamoDB for tickers, process the results and return sorted top movers', async () => {
        ddbMock.on(QueryCommandClass).resolves({
            Items: [
                { pk: 'AAPL', sk: '2026-06-09', close: 180, percentChange: 1.5 },
                { pk: 'AAPL', sk: '2026-06-08', close: 178, percentChange: -0.8 }
            ]
        });

        const { handler } = require('../src/lambdas/get-movers');

        const response = await handler({});
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        
        expect(body.data.length).toBe(2);
        expect(body.data[0].sk).toBe('2026-06-09');
        expect(body.data[1].sk).toBe('2026-06-08');
    });

    it('should correctly select the absolute maximum mover for a single date', async () => {
        ddbMock.on(QueryCommandClass).callsFake((command: any) => {
            const ticker = command.ExpressionAttributeValues?.[':pk'];
            if (ticker === 'AAPL') {
                return { Items: [{ pk: 'AAPL', sk: '2026-06-09', close: 180, percentChange: 1.5 }] };
            } else if (ticker === 'TSLA') {
                return { Items: [{ pk: 'TSLA', sk: '2026-06-09', close: 200, percentChange: -4.5 }] };
            } else if (ticker === 'NVDA') {
                return { Items: [{ pk: 'NVDA', sk: '2026-06-09', close: 900, percentChange: 3.0 }] };
            }
            return { Items: [] };
        });

        const { handler } = require('../src/lambdas/get-movers');
        const response = await handler({});
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(body.data.length).toBe(1);
        expect(body.data[0].pk).toBe('TSLA');
        expect(body.data[0].percentChange).toBe(-4.5);
    });

    it('should set Cache-Control max-age to 60 seconds if data has less than 7 items', async () => {
        ddbMock.on(QueryCommandClass).resolves({
            Items: [
                { pk: 'AAPL', sk: '2026-06-09', close: 180, percentChange: 1.5 }
            ]
        });

        const { handler } = require('../src/lambdas/get-movers');
        const response = await handler({});
        expect(response.statusCode).toBe(200);
        expect(response.headers['Cache-Control']).toBe('public, max-age=60');
    });

    it('should set Cache-Control max-age to next refresh time if data has 7 items', async () => {
        ddbMock.on(QueryCommandClass).callsFake((command: any) => {
            const ticker = command.ExpressionAttributeValues?.[':pk'];
            if (ticker === 'AAPL') {
                return {
                    Items: [
                        { pk: 'AAPL', sk: '2026-06-09', close: 180, percentChange: 1.5 },
                        { pk: 'AAPL', sk: '2026-06-08', close: 178, percentChange: 1.2 },
                        { pk: 'AAPL', sk: '2026-06-07', close: 176, percentChange: 1.0 },
                        { pk: 'AAPL', sk: '2026-06-06', close: 174, percentChange: 0.8 },
                        { pk: 'AAPL', sk: '2026-06-05', close: 172, percentChange: 0.6 },
                        { pk: 'AAPL', sk: '2026-06-04', close: 170, percentChange: 0.4 },
                        { pk: 'AAPL', sk: '2026-06-03', close: 168, percentChange: 0.2 },
                    ]
                };
            }
            return { Items: [] };
        });

        const { handler } = require('../src/lambdas/get-movers');
        const response = await handler({});
        expect(response.statusCode).toBe(200);
        
        const cacheControl = response.headers['Cache-Control'];
        expect(cacheControl).toBeDefined();
        expect(cacheControl).not.toBe('public, max-age=60');
        
        const match = cacheControl.match(/max-age=(\d+)/);
        expect(match).not.toBeNull();
        const maxAge = parseInt(match[1], 10);
        expect(maxAge).toBeGreaterThan(60);
    });

    it('should cap the response at the 7 most recent days when ticker histories are misaligned', async () => {
        // AAPL has records for 2026-06-03 through 2026-06-09, TSLA for 2026-06-02 through 2026-06-08.
        // The union spans 8 distinct dates, but the response should only contain the 7 most recent.
        const buildItems = (ticker: string, startDay: number) => {
            const items = [];
            for (let i = 0; i < 7; i++) {
                const day = String(startDay - i).padStart(2, '0');
                items.push({ pk: ticker, sk: `2026-06-${day}`, close: 100 + i, percentChange: 1.0 });
            }
            return items;
        };

        ddbMock.on(QueryCommandClass).callsFake((command: any) => {
            const ticker = command.ExpressionAttributeValues?.[':pk'];
            if (ticker === 'AAPL') return { Items: buildItems('AAPL', 9) };
            if (ticker === 'TSLA') return { Items: buildItems('TSLA', 8) };
            return { Items: [] };
        });

        const { handler } = require('../src/lambdas/get-movers');
        const response = await handler({});
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.count).toBe(7);
        expect(body.data.length).toBe(7);

        // Newest first, and the oldest date (2026-06-02) should be the one dropped
        expect(body.data[0].sk).toBe('2026-06-09');
        expect(body.data[6].sk).toBe('2026-06-03');
        const dates = body.data.map((item: any) => item.sk);
        expect(dates).not.toContain('2026-06-02');
    });

    it('should return 500 error if query fails', async () => {
        ddbMock.on(QueryCommandClass).rejects(new Error('DynamoDB Error'));

        const { handler } = require('../src/lambdas/get-movers');
        const response = await handler({});
        expect(response.statusCode).toBe(500);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
    });
});
