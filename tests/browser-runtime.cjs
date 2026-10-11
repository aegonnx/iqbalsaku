const {chromium}=require('playwright');
const fs=require('node:fs');
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
module.exports={chromium,launchOptions:{headless:true,...(executablePath ? {executablePath} : process.platform==='win32' ? {channel:'msedge'} : {})}};
