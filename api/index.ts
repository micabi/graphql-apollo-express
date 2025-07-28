import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
// import { startStandaloneServer } from "@apollo/server/standalone";
import express, { Application } from "express";
import http from "http";
import { expressMiddleware } from "@as-integrations/express5";
import cors from "cors";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { typeDefs, resolvers } from "./graphql/schema";


// const todos: typeTodo[] = [
//   {
//     id: "1",
//     title: "GraphQL",
//     completed: false
//   },
//   {
//     id: "2",
//     title: "React",
//     completed: false
//   }
// ];

const prismaInstance = new PrismaClient();
const app: Application = express();
const httpServer = http.createServer( app );

// サーバー(GraphQLに必要なtypeDefsとresolversを引数として渡す)
const apolloserver = new ApolloServer( {
  typeDefs,
  resolvers,
  plugins: [ ApolloServerPluginDrainHttpServer( { httpServer } ) ]
} );

async function listenServer (): Promise<void> {

  await apolloserver.start();

  // app.use("/todos", cors<cors.CorsRequest>({
  app.use( cors<cors.CorsRequest>( {
    origin: `${process.env.PRODUCT_URL}`, // クロスサイトによるアクセスを許可するorigin
    credentials: true, // レスポンスヘッダーにAccess-Control-Allow-Credentials追加
    optionsSuccessStatus: 200
  } ) );
  app.use( express.json() );
  app.use(
    expressMiddleware( apolloserver, {
      context: async (): Promise<{ prismaInstance: PrismaClient; }> => ( { prismaInstance } )
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