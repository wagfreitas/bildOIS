export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  oracle: {
    baseUrl: process.env.ORACLE_BASE_URL,
    username: process.env.ORACLE_USERNAME,
    password: process.env.ORACLE_PASSWORD,
    apiVersion: process.env.API_VERSION || '11.13.18.05',
  },
  
  masterOrg: {
    code: process.env.MASTER_ORG_CODE,
    defaultItemClass: process.env.DEFAULT_ITEM_CLASS || 'Root Item Class',
    defaultStatus: process.env.DEFAULT_STATUS || 'Active',
    defaultUOM: process.env.DEFAULT_UOM || 'Each',
    defaultLifecycle: process.env.DEFAULT_LIFECYCLE || 'Production',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
});
