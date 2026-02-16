"use server";
//import EnvHandler from '@/services/EnvHandler';
import { GraphQLClient } from 'graphql-request';

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || "https://indexer.dev.hyperindex.xyz/18880d0/v1/graphql";
//const GRAPH_API_KEY = "your-graphql-api-key";

const graphClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: {  
    'Content-Type': 'application/json',
    //'Authorization': `Bearer ${GRAPH_API_KEY}`,
  },
});

export async function backendQuery<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<{ data?: T; error?: any }> {
  try {
    const data = await graphClient.request<T>(query, variables);
    return { data };
  } catch (error) {
    return { error };
  }
}