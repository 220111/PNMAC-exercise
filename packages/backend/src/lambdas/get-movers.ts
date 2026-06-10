import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"];

let cachedMovers: any = null;
let cacheExpirationTimestamp = 0;

export const handler = async (event: any) => {
    try {

        const now = Date.now();

        if (cachedMovers && now < cacheExpirationTimestamp) {
            console.log("Cache Hit: Returning data from lambda memory");
            return createResponse(cachedMovers, cacheExpirationTimestamp);
        }

        console.log("Cache Miss: Fetching and returning fresh data");

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

            dayRecords.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
            
            return dayRecords[0]; 
        });

        dailyWinners.sort((a, b) => b.sk.localeCompare(a.sk));

        cachedMovers = dailyWinners;
        cacheExpirationTimestamp = getNextRefreshTime();

        return createResponse(dailyWinners, cacheExpirationTimestamp);
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

// sends back success response with browser cache control header that expires at expirationMs
function createResponse(data: any, expirationMs: number) {
  const secondsUntilRefresh = Math.max(0, Math.floor((expirationMs - Date.now()) / 1000));

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${secondsUntilRefresh}`,
    },
    body: JSON.stringify({
      success: true,
      count: data.length,
      data: data,
    }),
  };
}

function getNextRefreshTime(): number {
  const now = new Date();
  const next = new Date(now);
  
  // target set to 08:20:00 UTC (20 minutes after the next overnight cron)
  next.setUTCHours(8, 20, 0, 0); 

  if (now.getTime() > next.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  
  return next.getTime();
}