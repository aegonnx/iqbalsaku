import {build} from 'esbuild';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd(),sourcefile:'supabase-client.mjs'},outfile:'dist/supabase.mjs',bundle:true,minify:true,format:'esm',platform:'browser',target:['safari16','chrome100'],legalComments:'eof'});
