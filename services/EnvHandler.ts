import { ChainId } from "@storyhunt/sdk-core";

interface IEnvironmentVariables {
  githubAccessToken: string;
  jsonRpcUrl: string;
  graphEndpoint: string;
  graphApiKey: string;
  explorerUrl: string;
  clickhouseUrl: string;
  clickhouseUser: string;
  clickhousePassword: string;
  awsSecretAccessKey: string;
  awsBucketName: string;
  awsAccessKeyId: string;
  awsRegion: string;
  useGraphOnClient: string;
  tenderlyBaseUrl: string;
  tenderlyUser: string;
  tenderlyProject: string;
  tenderlyAccessKey: string;
  projectId: string;
  privateRpcUrl: string;
  clientId: string;
  appUrl: string;
}

export class EnvHandler {
  static instance: EnvHandler;
  public network: Exclude<ChainId, ChainId.ODYSSEY> = process.env.NEXT_PUBLIC_CHAINID === '1315' ? ChainId.AENEID : ChainId.STORY;
  private clientSafeMapping = {
    'NEXT_PUBLIC_AENEID_GRAPHQL_ENDPOINT': process.env.NEXT_PUBLIC_AENEID_GRAPHQL_ENDPOINT || '',
    'NEXT_PUBLIC_STORY_GRAPHQL_ENDPOINT': process.env.NEXT_PUBLIC_STORY_GRAPHQL_ENDPOINT || '',
    'NEXT_PUBLIC_USE_GRAPH_ON_CLIENT': process.env.NEXT_PUBLIC_USE_GRAPH_ON_CLIENT || 'false',
    'NEXT_PUBLIC_PROJECT_ID': process.env.NEXT_PUBLIC_PROJECT_ID || '',
    'NEXT_PUBLIC_CLIENT_ID': process.env.NEXT_PUBLIC_CLIENT_ID || '',
    'NEXT_PUBLIC_STORY_JSON_RPC_URL': process.env.NEXT_PUBLIC_STORY_JSON_RPC_URL || '',
    'NEXT_PUBLIC_STORY_EXPLORER_URL': process.env.NEXT_PUBLIC_STORY_EXPLORER_URL || '',
    'NEXT_PUBLIC_AENEID_JSON_RPC_URL': process.env.NEXT_PUBLIC_AENEID_JSON_RPC_URL || '',
    'NEXT_PUBLIC_AENEID_EXPLORER_URL': process.env.NEXT_PUBLIC_AENEID_EXPLORER_URL || '',
    'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL || '',
    }

  public networkMappings: Record<Exclude<ChainId, ChainId.ODYSSEY>, Record<keyof IEnvironmentVariables, string>> = {
    [ChainId.STORY]: {
      githubAccessToken: 'GITHUB_GIST_ACCESS_TOKEN',
      jsonRpcUrl: 'NEXT_PUBLIC_STORY_JSON_RPC_URL',
      graphEndpoint: 'NEXT_PUBLIC_STORY_GRAPHQL_ENDPOINT',
      graphApiKey: 'GRAPH_API_KEY',
      explorerUrl: 'NEXT_PUBLIC_STORY_EXPLORER_URL',
      clickhouseUrl: 'STORY_CLICKHOUSE_URL',
      clickhouseUser: 'STORY_CLICKHOUSE_USER',
      clickhousePassword: 'STORY_CLICKHOUSE_PASSWORD',
      awsSecretAccessKey: 'AWS_SECRET_ACCESS_KEY',
      awsBucketName: 'AWS_BUCKET_NAME',
      awsAccessKeyId: 'AWS_ACCESS_KEY_ID',
      awsRegion: 'AWS_REGION',
      useGraphOnClient: 'NEXT_PUBLIC_USE_GRAPH_ON_CLIENT',
      tenderlyBaseUrl: 'NEXT_TRENDERLY_URL',
      tenderlyUser: 'NEXT_TRENDERLY_USER',
      tenderlyProject: 'NEXT_TRENDERLY_PROJECT',
      tenderlyAccessKey: 'NEXT_TRENDERLY_ACCESS_KEY',
      projectId: 'NEXT_PUBLIC_PROJECT_ID',
      privateRpcUrl: 'STORY_PRIVATE_RPC_URL',
      clientId: 'NEXT_PUBLIC_CLIENT_ID',
      appUrl: 'NEXT_PUBLIC_APP_URL',
    },
    [ChainId.AENEID]: {
      githubAccessToken: 'GITHUB_GIST_ACCESS_TOKEN',
      jsonRpcUrl: 'NEXT_PUBLIC_AENEID_JSON_RPC_URL',
      graphEndpoint: 'NEXT_PUBLIC_AENEID_GRAPHQL_ENDPOINT',
      graphApiKey: 'GRAPH_API_KEY',
      explorerUrl: 'NEXT_PUBLIC_AENEID_EXPLORER_URL',
      clickhouseUrl: 'AENEID_CLICKHOUSE_URL',
      clickhouseUser: 'AENEID_CLICKHOUSE_USER',
      clickhousePassword: 'AENEID_CLICKHOUSE_PASSWORD',
      awsSecretAccessKey: 'AWS_SECRET_ACCESS_KEY',
      awsBucketName: 'AWS_BUCKET_NAME',
      awsAccessKeyId: 'AWS_ACCESS_KEY_ID',
      awsRegion: 'AWS_REGION',
      useGraphOnClient: 'NEXT_PUBLIC_USE_GRAPH_ON_CLIENT',
      tenderlyBaseUrl: 'NEXT_TRENDERLY_URL',
      tenderlyUser: 'NEXT_TRENDERLY_USER',
      tenderlyProject: 'NEXT_TRENDERLY_PROJECT',
      tenderlyAccessKey: 'NEXT_TRENDERLY_ACCESS_KEY',
      projectId: 'NEXT_PUBLIC_PROJECT_ID',
      privateRpcUrl: 'AENEID_PRIVATE_RPC_URL',
      clientId: 'NEXT_PUBLIC_CLIENT_ID',
      appUrl: 'NEXT_PUBLIC_APP_URL',
    },
  };

  private constructor() {}

  static getInstance(): EnvHandler {
    if (!EnvHandler.instance) {
      EnvHandler.instance = new EnvHandler();
    }
    return EnvHandler.instance;
  }

  updateNetwork(network: Exclude<ChainId, ChainId.ODYSSEY>) {
    sessionStorage.setItem('network', network.toString());
  }

  // Access environment variables based on the network type
  getVariable(key: keyof IEnvironmentVariables, network = this.network) {
    const envVar = this.networkMappings[network][key];
    
    if(typeof window !== 'undefined') {
      //for client side, we need to use NEXT_PUBLIC_ prefixed direct accessed env variables
      return this.clientSafeMapping[envVar as keyof typeof this.clientSafeMapping]
    }
    return eval(`process.env.${envVar}`);
  }
}

export default EnvHandler;
