/**
 * Token server for Vertex AI authentication.
 * Generates short-lived OAuth2 access tokens from a service account.
 * The browser fetches a token, then connects directly to the Vertex AI Live API.
 *
 * Usage: npx tsx server/token-server.ts
 */
import express from "express";
import cors from "cors";
import { GoogleAuth } from "google-auth-library";
import path from "path";

const PORT = parseInt(process.env.TOKEN_SERVER_PORT || "3001", 10);

// Resolve service account key path — look for any *.json service account file
// in the project root, or use the SERVICE_ACCOUNT_KEY_PATH env var.
const projectRoot = path.resolve(__dirname, "..");
const keyFilePath =
    process.env.SERVICE_ACCOUNT_KEY_PATH ||
    path.join(projectRoot, "synapse-489819-990950fad31f.json");

console.log(`[token-server] Using service account key: ${keyFilePath}`);

const auth = new GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const app = express();
app.use(cors({ origin: true }));

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Token endpoint — generates a short-lived access token
app.get("/api/token", async (_req, res) => {
    try {
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();

        if (!tokenResponse.token) {
            throw new Error("Failed to generate access token");
        }

        // Access tokens typically expire in 3600 seconds (1 hour)
        res.json({
            accessToken: tokenResponse.token,
            expiresAt: Date.now() + 3500_000, // 3500s to refresh slightly before expiry
        });

        console.log(
            `[token-server] Token generated at ${new Date().toISOString()}`
        );
    } catch (err: any) {
        console.error("[token-server] Token generation failed:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`[token-server] Running on http://localhost:${PORT}`);
    console.log(`[token-server] Token endpoint: http://localhost:${PORT}/api/token`);
    console.log(`[token-server] Health check: http://localhost:${PORT}/api/health`);
});
