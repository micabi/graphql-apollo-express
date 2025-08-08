import { ApolloServer, GraphQLResponse } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageProductionDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
// import { startStandaloneServer } from "@apollo/server/standalone";
import { ValidationContext, GraphQLError, GraphQLFormattedError } from "graphql";
import graphqlDepthLimit from "graphql-depth-limit";
import { createComplexityLimitRule } from "graphql-validation-complexity";
import express, { Application } from "express";
import { ExpressContextFunctionArgument, expressMiddleware } from "@as-integrations/express5";
import rateLimit, { MemoryStore, RateLimitRequestHandler, ipKeyGenerator } from "express-rate-limit";
import { createClient } from "redis";
import { RedisReply, RedisStore } from "rate-limit-redis";
import http from "http";
import cors from "cors";
import moment from "moment";
import "moment-timezone"
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { typeDefs, resolvers } from "./graphql/schema";

const prismaInstance = new PrismaClient();
const app: Application = express();
const httpServer = http.createServer( app );
const redisClient = createClient( {
  url: process.env.REDIS_URL,
} );

redisClient.on( 'error', ( error: Error ): void => {
  console.error( `Redis connection error: ${ error.message }` );
} );

redisClient.connect();


const apiLimitter: RateLimitRequestHandler = rateLimit( {
  windowMs: 6 * 1000, // リクエストを記憶する時間（ミリ秒） 6000ms = 1分
  limit: 5, // windowMs内のリクエスト数
  statusCode: 429, // レスポンスステータスコード
  message: "🚨 Too many requests, please try again later.",
  standardHeaders: true, // RateLimit-* headersを使用
  legacyHeaders: false, // X-RateLimit-* headersを使用

  // handler: (req, res, next, options) => {
  //   if(req.ip) {
  //     console.log(req.ip);
  //   }
  // },

  // Redisを使用してリクエスト数を記録する
  // store: new MemoryStore(),
  store: new RedisStore( {
    sendCommand: ( ...args: string[] ): Promise<RedisReply> => redisClient.sendCommand( args ),
  } ),

  // クライアントを識別するためのキーを生成
  keyGenerator: ( req ) => {

    const agent: string = ( req.headers[ 'user-agent' ] ) ? req.headers[ 'user-agent' ] : 'undefined';
    const identifier: number = moment().unix();
    const time: string = moment().tz('Asia/Tokyo').format( "YYYY-MM-DD HH:mm:ssZ" );
    console.log(time);

    if ( req.query.apiKey ) {
      console.log( `API Key: ${ req.query.apiKey }. Rate limit exceeded for ${ req.query.apiKey }` );
      return req.query.apiKey as string;
    }

    if ( req.ip ) {
      const ipv6Subnet = 56;
      console.log( req.headers[ 'user-agent' ] );
      console.log( `🐾 Rate limit exceeded for ${ req.ip }` );
      redisClient.json.set(
        `users:${ identifier }`,
        "$",
        {
          "ip": `${ ipKeyGenerator( req.ip, ipv6Subnet ) }`,
          "agent": `${ agent }`,
          "time": `${ time }`
        }
      );
      redisClient.expire( `users:${ identifier }`, 86400 );
      return ipKeyGenerator( req.ip, ipv6Subnet );
    }
    // ユーザー情報がない場合はIPアドレスを使用し、なければ"unknown-ip"を返す

    console.log( `Rate limit exceeded for 'unknown-ip'` );
    redisClient.json.set(
      `users:${ identifier }`,
      "$",
      {
        "ip": 'unknown-ip',
        "agent": `${ agent }`,
        "time": `${ time }`
      }
    );
    redisClient.expire( `users:${ identifier }`, 86400 );
    return 'unknown-ip';
  },

} );

const complexityLimitRule: ( ctx: ValidationContext ) => any = createComplexityLimitRule( 4000, {
  scalarCost: 1,
  objectCost: 10,
  listFactor: 10,
  onCost: ( cost: number ): void => {
    console.log( `💩 Query complexity: ${ cost }` );
  },
  formatErrorMessage: ( cost: number ): string => {
    return `🚨 Query is too complex: ${ cost }.`;
  }
} );

const forbidTooManyQueryRule = ( ValidationContext: any ): any => {
  const { definitions } = ValidationContext.getDocument();
  definitions.forEach( ( definition: any ): void => {
    if ( definition.kind === 'OperationDefinition' ) {
      if ( definition.selectionSet.selections.length > 2 ) {
        ValidationContext.reportError(
          new GraphQLError(
            '🚨  Too Many request exceeds',
          ),
        );
      }
    }
  } );
  return ValidationContext;
};



// サーバー(GraphQLに必要なtypeDefsとresolversを引数として渡す)
const apolloserver = new ApolloServer( {
  typeDefs,
  resolvers,
  validationRules: [
    graphqlDepthLimit( 2 ), // クエリの深さを制限する
    complexityLimitRule, // 1度にリクエストできるクエリの件数を制限する(大量リクエストを防ぐ)
    forbidTooManyQueryRule, // クエリの件数を制限する
  ],
  plugins: [
    ApolloServerPluginDrainHttpServer( { httpServer } ), // HTTPサーバーがシャットダウンする際に、進行中のリクエストが完了するのを待つ
    process.env.NODE_ENV === "production"
      // ? ApolloServerPluginLandingPageProductionDefault( { footer: false })
      ? ApolloServerPluginLandingPageDisabled()
      : ApolloServerPluginLandingPageLocalDefault( { embed: true } ), // 開発環境ではplaygroundを表示させる
  ],
  // hideSchemaDetailsFromClientErrorsに置き換わった
  // formatError: ( formattedError: GraphQLFormattedError ): GraphQLFormattedError => {
  //   // 本番環境では、エラーメッセージを隠す
  //   if ( process.env.NODE_ENV === "production" ) {
  //     return {
  //       message: "Internal server error",
  //       // locations: formattedError.locations,
  //       // path: formattedError.path,
  //       // extensions: formattedError.extensions,
  //     };
  //   } else {
  //     return formattedError;
  //   }
  // },


  // 三項演算子とオブジェクトリテラルの組み合わせ。falseの場合は空のオブジェクトを返す
  ...( process.env.NODE_ENV === "production"
    ? { introspection: false } // 本番環境ではスキーマの情報を公開しない(// GraphQL introspection is not allowed by Apollo Server, but the query contained __schema or __type. To enable introspection, pass introspection: true to ApolloServer in production)
    : { introspection: true } // 開発環境ではスキーマの情報を公開する
  ),

  ...( process.env.NODE_ENV === "production"
    ? { csrfPrevention: true } // CSRF対策を有効にする
    : { csrfPrevention: false } // CSRF対策を有効にしない
  ),

  ...( process.env.NODE_ENV === "production"
    ? { hideSchemaDetailsFromClientErrors: true } // クライアントにスキーマのヒントを隠す
    : {}
  ),

} );

async function listenServer (): Promise<void> {

  await apolloserver.start();

  app.use( apiLimitter );  // リクエストを連続で投げつけるものを制限する

  // app.use("/todos", cors<cors.CorsRequest>({
  app.use( cors<cors.CorsRequest>( {
    ...( process.env.NODE_ENV === "production" )
      ? { origin: `${ process.env.PRODUCT_URL }` } // 本番環境では特定のURLのみを許可
      : { origin: '*' }, // 開発環境では全てのオリジンを許可
    credentials: true, // レスポンスヘッダーにAccess-Control-Allow-Credentials追加
    optionsSuccessStatus: 200, // 一部のブラウザで200以外のステータスコードが返されるとCORSエラーになるため、200を指定
  } ) );
  app.use( express.json() );
  app.use(
    expressMiddleware( apolloserver, {
      // context: async (): Promise<{ prismaInstance: PrismaClient }> => ( {
      //   prismaInstance
      // } ),
      context: async ( { req, res }: ExpressContextFunctionArgument ): Promise<{ token: string | string[] | undefined; prismaInstance: PrismaClient; }> => {

        if ( process.env.NODE_ENV === "production" ) {
          // if ( !req.headers.token ) {
          //   console.log( "No token provided in the request headers." );
          // throw new Error( "No token provided in the request headers." );
          // }
          console.log( `🐾  Request received with token: ${ req.headers.token }` );
          res.setHeader( 'Cache-Control', 'private, no-store, no-cache, must-revalidate' );
          res.setHeader( 'Pragma', 'no-cache' );
          res.setHeader( 'Expires', '0' );
          res.setHeader( 'X-Content-Type-Options', 'nosniff' );
          res.setHeader( 'X-Frame-Options', 'DENY' );
          res.setHeader( 'X-XSS-Protection', '1; mode=block' );
          res.setHeader( 'Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self';" );
          res.setHeader( 'Referrer-Policy', 'no-referrer' );
          res.setHeader( 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload' );
          res.setHeader( 'Access-Control-Allow-Headers', 'Content-Type, Authorization, token' );
        }

        return {
          ...( req.headers.token
            ? { token: req.headers.token }
            : { token: undefined }
          ),
          prismaInstance: prismaInstance
        };
      },
    } ) );

  // httpServer.listen( { port: process.env.PORT } );
  // console.log( `🚀 Express listen at ${ process.env.PUBLIC_URL }:${ process.env.PORT }` );
  // console.log( `🚀🚀🚀 GraphQL Server listen at ${ process.env.PUBLIC_URL }:${ process.env.PORT }/todos 😀😀😀` );
}

listenServer();

export default httpServer;
// async function listenServer (): Promise<void> {
//   const { url } = await startStandaloneServer( apolloserver, {
//     context: async (): Promise<{ prismaInstance: PrismaClient; }> => ( { prismaInstance } ),
//     listen: {
//       port: 4000,
//     },
//   } );
//   console.log( `Server ready at: ${ url }` );
// }


// const { url } = await startStandaloneServer( apolloserver, {
//   context: async (): Promise<{ prismaInstance: PrismaClient; }> => ( { prismaInstance } ),
//   listen: {port: 4000,},
// } );

// console.log( `Server ready at: ${ url }` );