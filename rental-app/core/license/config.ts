import { cloud } from "../sync/cloudConfig";

/** The "license" function on the rental app's own Supabase project. */
export const licenseServer = { url: `${cloud.supabaseUrl}/functions/v1/license`, anonKey: cloud.supabaseKey };
