// frontend/src/royaltyService.ts

import { jwtDecode } from 'jwt-decode';

// --- Configuration ---------------------------------------------------------

/**
 * The base URL for the Canton participant's JSON API.
 * In a real application, this would come from an environment variable.
 * e.g., `process.env.REACT_APP_JSON_API_URL`
 */
const JSON_API_URL = "http://localhost:7575";

/**
 * The package ID of the compiled Daml code (the .dar file).
 * This must be updated after you build the Daml code.
 * You can find it by running:
 * `dpm damlc inspect-dar --json .daml/dist/canton-royalty-engine-0.1.0.dar`
 * and looking for the "main_package_id" field.
 */
const PACKAGE_ID = "YOUR_MAIN_PACKAGE_ID_HERE";

/**
 * Fully qualified template identifiers.
 */
export const TEMPLATE_IDS = {
    ContentRoyaltyAgreement: `${PACKAGE_ID}:RoyaltyCalculation:ContentRoyaltyAgreement`,
    RightsHolderRegistration: `${PACKAGE_ID}:RoyaltyCalculation:RightsHolderRegistration`,
    RoyaltyPayment: `${PACKAGE_ID}:RoyaltyCalculation:RoyaltyPayment`,
    UsageReport: `${PACKAGE_ID}:RoyaltyCalculation:UsageReport`,
};


// --- Type Definitions ------------------------------------------------------
// These types mirror the Daml templates defined in the project.

export interface Period {
    start: string; // ISO 8601 Date string (YYYY-MM-DD)
    end: string;   // ISO 8601 Date string (YYYY-MM-DD)
}

export interface RightsHolderRegistration {
    operator: string;
    contentId: string;
    rightsHolder: string;
    share: string; // Daml Decimal as a string (e.g., "0.5000000000")
}

export interface RoyaltyPayment {
    operator: string;
    contentId: string;
    rightsHolder: string;
    amount: string; // Daml Decimal as a string
    paymentPeriod: Period;
    sourceUsageReportCid: string; // ContractId as a string
}

export interface UsageReport {
    operator: string;
    licensee: string;
    contentId: string;
    revenue: string; // Daml Decimal as a string
    usagePeriod: Period;
}

/**
 * Represents an active contract on the ledger, as returned by the JSON API.
 */
export interface ActiveContract<T> {
    contractId: string;
    templateId: string;
    payload: T;
}

/**
 * Payload structure for a JWT issued by a Canton participant.
 */
interface CantonJwtPayload {
    "https://daml.com/ledger-api": {
        ledgerId: string;
        applicationId: string;
        actAs: string[];
        readAs?: string[];
    };
    party: string; // The primary party ID
}


// --- Private Helper Functions ----------------------------------------------

/**
 * A generic helper to make requests to the JSON API.
 * It automatically adds the Authorization header and handles response parsing and errors.
 * @param endpoint The API endpoint to call (e.g., "/v1/query").
 * @param token The JWT for authentication.
 * @param body The request body.
 * @returns The "result" field from the JSON API response.
 */
async function fetchFromApi<T>(endpoint: string, token: string, body: object): Promise<T> {
    const response = await fetch(`${JSON_API_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("JSON API request failed:", errorBody);
        throw new Error(`Request to ${endpoint} failed with status ${response.status}: ${errorBody}`);
    }

    const jsonResponse = await response.json();

    if (jsonResponse.status !== 200) {
        const errorMessage = jsonResponse.errors?.join(', ') || 'Unknown API error';
        console.error("JSON API returned an error:", errorMessage);
        throw new Error(`JSON API returned status ${jsonResponse.status}: ${errorMessage}`);
    }

    return jsonResponse.result;
}


// --- Public Service Functions ----------------------------------------------

/**
 * Parses a JWT to extract the primary party ID.
 * @param token The JWT.
 * @returns The primary party ID associated with the token.
 */
export const getPartyId = (token: string): string => {
    const decoded = jwtDecode<CantonJwtPayload>(token);
    if (!decoded.party) {
        throw new Error("JWT does not contain a 'party' claim. Please use a token from a Canton 3+ participant.");
    }
    return decoded.party;
};

/**
 * Fetches all active RightsHolderRegistration contracts for a specific content ID.
 * @param contentId The unique identifier for the content.
 * @param token The authentication token.
 * @returns A promise that resolves to an array of active RightsHolderRegistration contracts.
 */
export const getRightsHolders = async (contentId: string, token: string): Promise<ActiveContract<RightsHolderRegistration>[]> => {
    return fetchFromApi<ActiveContract<RightsHolderRegistration>[]>(
        "/v1/query",
        token,
        {
            templateIds: [TEMPLATE_IDS.RightsHolderRegistration],
            query: { contentId },
        }
    );
};

/**
 * Fetches all RoyaltyPayment contracts for the party associated with the token.
 * @param token The authentication token. The function will query for the token's primary party.
 * @returns A promise that resolves to an array of active RoyaltyPayment contracts.
 */
export const getMyRoyaltyPayments = async (token: string): Promise<ActiveContract<RoyaltyPayment>[]> => {
    return fetchFromApi<ActiveContract<RoyaltyPayment>[]>(
        "/v1/query",
        token,
        {
            templateIds: [TEMPLATE_IDS.RoyaltyPayment],
        }
    );
};

/**
 * Fetches all UsageReport contracts visible to the current user.
 * @param token The authentication token.
 * @returns A promise that resolves to an array of active UsageReport contracts.
 */
export const getUsageReports = async (token: string): Promise<ActiveContract<UsageReport>[]> => {
    return fetchFromApi<ActiveContract<UsageReport>[]>(
        "/v1/query",
        token,
        {
            templateIds: [TEMPLATE_IDS.UsageReport],
        }
    );
}

/**
 * Creates a new UsageReport contract on the ledger.
 * This is typically done by a licensee to report revenue for a piece of content.
 * @param report The UsageReport payload, containing licensee, revenue, period, etc.
 * @param token The authentication token of the licensee.
 * @returns The created UsageReport contract.
 */
export const reportUsage = async (report: UsageReport, token: string): Promise<ActiveContract<UsageReport>> => {
    return fetchFromApi<ActiveContract<UsageReport>>(
        "/v1/create",
        token,
        {
            templateId: TEMPLATE_IDS.UsageReport,
            payload: report,
        }
    );
};

/**
 * Exercises the `DistributeRoyalties` choice on a `ContentRoyaltyAgreement` contract.
 * This choice triggers the calculation and creation of `RoyaltyPayment` contracts.
 * @param agreementCid The ContractId of the `ContentRoyaltyAgreement`.
 * @param usageReportCid The ContractId of the `UsageReport` to process.
 * @param token The authentication token of the operator.
 * @returns The result of the choice exercise from the JSON API.
 */
export const distributeRoyalties = async (agreementCid: string, usageReportCid: string, token: string): Promise<any> => {
    return fetchFromApi<any>(
        "/v1/exercise",
        token,
        {
            templateId: TEMPLATE_IDS.ContentRoyaltyAgreement,
            contractId: agreementCid,
            choice: "DistributeRoyalties",
            argument: {
                usageReportCid,
            },
        }
    );
};