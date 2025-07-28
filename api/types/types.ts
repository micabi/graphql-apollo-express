import { type PrismaClient } from "@prisma/client";

// typescriptの型指定
type typeTodo = {
  id: number,
  title: string,
  completed: boolean,
};

type Resolvers = {
  Query: {},
  Mutation: {}
};

type Context = {
  prismaInstance: PrismaClient;
};
export {typeTodo, Resolvers, Context};