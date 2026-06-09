import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"];

export const handler = async (event: any) => {
    try {
        const tableName = process.env.TABLE_NAME;

        const fetchPromises = TICKERS.map((ticker) => {
            return docClient.send(
                new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: "pk = :pk",
                    ExpressionAttributeValues: {
                        ":pk": ticker,
                    },
                    ScanIndexForward: false,
                    Limit: 7,
                })
            )
        });

        const results = await Promise.all(fetchPromises);
        const allRecords = results.flatMap((result) => result.Items ?? []);

        const recordsByDate: Record<string, any[]> = {};
        for (const record of allRecords) {
            const date = record.sk;
            if (!recordsByDate[date]) {
                recordsByDate[date] = [];
            }
            recordsByDate[date].push(record);
        }

        const dailyWinners = Object.keys(recordsByDate).map((date) => {
            const dayRecords = recordsByDate[date];

            dayRecords.sort((a, b) => b.percentChange - a.percentChange);
            
            return dayRecords[0]; 
        });

        dailyWinners.sort((a, b) => b.sk.localeCompare(a.sk));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                success: true,
                count: dailyWinners.length,
                data: dailyWinners
            })
        };
    } catch (error) {
        console.error("Error fetching movers:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ success: false, message: "Internal Server Error" }),
        };
    }
}