import dotenv from 'dotenv';
import { validateEnvironment } from '../config/env';

const envFile = process.env.ENV_FILE || '.env.production';

dotenv.config({ path: envFile });
process.env.NODE_ENV = 'production';

validateEnvironment();

console.log(`Production environment OK (${envFile})`);
