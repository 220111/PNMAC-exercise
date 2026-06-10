import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const secretsMock = mockClient(SecretsManagerClient);
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('ingest Lambda Handler', () => {
    let fetchSpy: jest.SpyInstance;
    const originalSetTimeout = global.setTimeout;

    beforeEach(() => {
        secretsMock.reset();
        ddbMock.reset();
        process.env.AWS_ACCESS_KEY_ID = 'fake-access-key-id';
        process.env.AWS_SECRET_ACCESS_KEY = 'fake-secret-access-key';
        process.env.AWS_REGION = 'us-east-1';
        process.env.TABLE_NAME = 'TestTable';
        process.env.SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:TestSecret';
        
        fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        global.setTimeout = originalSetTimeout;
    });

    it('should query existing records, fetch missing records from Massive API, calculate percent change and write to DynamoDB', async () => {
        secretsMock.on(GetSecretValueCommand).resolves({
            SecretString: 'fake-api-key'
        });

        ddbMock.on(QueryCommand).resolves({
            Items: []
        });

        ddbMock.on(PutCommand).resolves({});

        fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                status: 'OK',
                symbol: 'AAPL',
                from: '2026-06-09',
                open: 100,
                close: 105, // (105 - 100) / 100 * 100 = 5%
                volume: 1000,
                afterHours: 105,
                preMarket: 100
            })
        } as any);

        const { handler } = require('../src/lambdas/ingest');

        const event = {} as any;
        const context = {} as any;
        await handler(event, context);

        expect(secretsMock.call(0).args[0].input).toEqual({
            SecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:TestSecret'
        });

        const putCalls = ddbMock.commandCalls(PutCommand);
        expect(putCalls.length).toBeGreaterThan(0);
        
        const firstPut = putCalls[0].args[0].input as any;
        expect(firstPut.TableName).toBe('TestTable');
        expect(firstPut.Item).toBeDefined();
        expect(firstPut.Item?.close).toBe(105);
        expect(firstPut.Item?.percentChange).toBe(5);
    });

    it('should handle API rate limit (429) and retry after sleeping', async () => {
        (global as any).setTimeout = (cb: any, ms: any) => cb();

        secretsMock.on(GetSecretValueCommand).resolves({
            SecretString: 'fake-api-key'
        });

        ddbMock.on(QueryCommand).resolves({
            Items: []
        });

        ddbMock.on(PutCommand).resolves({});

        fetchSpy
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            } as any)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    symbol: 'AAPL',
                    open: 100,
                    close: 102
                })
            } as any)
            .mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    symbol: 'MSFT',
                    open: 100,
                    close: 100
                })
            } as any);

        const { handler } = require('../src/lambdas/ingest');
        const event = {} as any;
        const context = {} as any;
        await handler(event, context);

        expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
    });
});
