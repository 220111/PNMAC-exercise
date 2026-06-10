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

    it('should return 500 error if query fails', async () => {
        ddbMock.on(QueryCommandClass).rejects(new Error('DynamoDB Error'));

        const { handler } = require('../src/lambdas/get-movers');
        const response = await handler({});
        expect(response.statusCode).toBe(500);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
    });
});
