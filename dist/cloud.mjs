import {cloudConfig} from './cloud-config.mjs';
export async function createCloudClient(){
 if(!cloudConfig.url&&!cloudConfig.key)return null;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cloudConfig.url)||!cloudConfig.key)throw new Error('Online storage is not configured correctly. Your device data is unchanged.');
 const {createClient}=await import('./supabase.mjs');
 return createClient(cloudConfig.url,cloudConfig.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
