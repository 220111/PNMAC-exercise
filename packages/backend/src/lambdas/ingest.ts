import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ScheduledEvent, Context } from "aws-lambda";

export interface StockSummaryResponse {
  status: string;
  symbol: string;
  from: string; // format: YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  afterHours: number;
  preMarket: number;
  otc?: boolean;
}

const secretsClient = new SecretsManagerClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Note: this gets the last 7 days that COULD be market days
// It does not account for market holidays. 
// These days will fail from the API and the function will log the issue and move on.
// Any actual failures will be logged and self-healed the following days.
function getLastSevenMarketDays(): string[] {
    const dates: string[] = [];
    const now = new Date();

    const nyTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyTimeStr);

    let dayOffset = 1;

    while (dates.length < 7) {
        const targetDate = new Date(nyDate);
        targetDate.setDate(targetDate.getDate() - dayOffset);

        const dayOfWeek = targetDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (!isWeekend) {
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            
            dates.push(`${year}-${month}-${day}`);
        }

        dayOffset++;
    }

    return dates;
}

export const handler = async (event: ScheduledEvent, context: Context): Promise<void> => {
    console.log("Starting daily ingestion...", JSON.stringify(event));

    const tableName = process.env.TABLE_NAME;
    const secretArn = process.env.SECRET_ARN;

    if (!tableName) {
        throw new Error("Missing required environment variable: TABLE_NAME");
    }
    if (!secretArn) {
        throw new Error("Missing required environment variable: SECRET_ARN");
    }

    try {

        const secretResponse = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: secretArn })
        );
        const apiKey = secretResponse.SecretString;
        console.log("Successfully retrieved Massive API Key from Secrets Manager");

        const targetDates = getLastSevenMarketDays();

        for (const ticker of TICKERS) {
            console.log("Verifying existing records and ingesting new records for ticker: ", ticker);

            const existingRecords = await docClient.send(
                new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: "pk = :pk",
                    ExpressionAttributeValues: {
                        ":pk": ticker,
                    },
                })
            );

            const existingDates = new Set(
                (existingRecords.Items || []).map((item) => item.sk)
            );

            const missingDates = targetDates.filter((date) => !existingDates.has(date));

            for (const date of missingDates) {
                console.log(`Fetching data for ${ticker} on ${date}`);
                
                const apiUrl = `https://api.massive.com/v1/open-close/${ticker}/${date}`;
                const options = { 
                    headers: { 'Authorization': `Bearer ${apiKey}` } 
                };

                try {
                    let response = await fetch(apiUrl, options);

                    // Massive free tier rate limit of 5 requests per minute
                    // Simple run until rate limit and then wait the full timeout logic
                    // 
                    // Note: This is only a single retry but is safe due to self-healing.
                    //       Any dates that hit the rate limit twice will be filled in the next day.
                    //       This is all logged.
                    if (response.status === 429) {
                        console.warn(`Rate limit hit (429). Waiting for 65 seconds before retrying...`);
                        await sleep(65000);
                        
                        console.log(`Retrying fetch for ${ticker} on ${date}`);
                        response = await fetch(apiUrl, options);
                    }

                    if (!response.ok) {
                        console.error(`API returned non-ok status, ${response.status}, for ${ticker} on ${date}`);
                        continue;
                    } else {

                        const data = (await response.json()) as StockSummaryResponse;

                        const openPrice = data.open;
                        const closePrice = data.close;
                        const percentChange = openPrice !== 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0;

                        await docClient.send(
                            new PutCommand({
                                TableName: tableName,
                                Item: {
                                    pk: ticker,
                                    sk: date,
                                    close: data.close,
                                    percentChange: Number(percentChange.toFixed(2)),
                                },
                            })
                        );
                    }
                } catch (apiError) {
                    console.error(`Failed to ingest ${ticker} for date ${date}:`, apiError);
                }
            }
        }

        
    } catch (error) {
        console.error("Daily ingestion job failed:", error);
        throw error;
    }
}