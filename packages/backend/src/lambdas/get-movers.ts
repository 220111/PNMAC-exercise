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

        // if cachedMovers is less than 7 then it's likely the ingest is still running its initial batch
        // and we should revalidate the cache
        if (cachedMovers && now < cacheExpirationTimestamp && cachedMovers.length == 7) {
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

        const dailyMovers = Object.keys(recordsByDate).map((date) => {
            const dayRecords = recordsByDate[date];

            dayRecords.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
            
            return dayRecords[0]; 
        });

        const topMovers = dailyMovers.sort((a, b) => b.sk.localeCompare(a.sk)).slice(0, 7);

        cachedMovers = topMovers;
        cacheExpirationTimestamp = getNextRefreshTime();

        return createResponse(topMovers, cacheExpirationTimestamp);
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
//
// if data has less than one week of data points then cache should expire in a minute,
// when more data is likely to be available
function createResponse(data: any, expirationMs: number) {
  let secondsUntilRefresh = Math.max(0, Math.floor((expirationMs - Date.now()) / 1000));

  if (data.length < 7) {
    secondsUntilRefresh = 60;
  }

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