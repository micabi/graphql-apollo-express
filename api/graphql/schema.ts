import { type typeTodo, type Resolvers, type Context } from "types/types";

// どんなデータがあり、どんな関係性かschema.prismaに書くmodelに合わせて。
// フロント側で使う@apollo/clientでは
// import { gql } from "@apollo/client";
// const typeDefs = gql``;と書くが
// @apollo/clientはreactで使うモジュールなのでバック側では使えない。
// よってgql``ではなく`#graphql`と書く
const typeDefs: string = `#graphql

  type Todo {
  """
  Todoオブジェクトの内容
  """
    id: Int!,
    title: String!,
    completed: Boolean!
  }

  type Query {
  """
  すべてのTodoを取得
  """
    getTodos: [Todo!]!
  }

  type Mutation {
  """
  1件のTodoを追加
  """
    addTodo(title: String!): Todo!
  """
  1件のTodoのcompletedをtrue,falseで変更
  """
    updateTodo(id: Int!, completed: Boolean!): Todo!
"""
  1件のTodoを削除
  """
    deleteTodo(id: Int!): Todo!
  }
`;

// SQLのクエリを実行するのが@prisma/client
// 直接graphQLのクエリ文を書くのではなくprismaを介してtypescriptでおこなう
// prismaの文脈を通して...の意味。QueryやMutationの引数で渡す
const resolvers: Resolvers = {
  Query: { // Queryはget
    // getTodos: (): typeTodo[] => todos

    getTodos: async ( _: typeTodo, __: typeTodo[], context: Context ): Promise<{ id: number, title: string, completed: boolean; }[]> => {
      // sql文を直接操作するのではなく、prismaのメソッドを介して操作する。
      const todos: typeTodo[] = await context.prismaInstance.todo.findMany();

      // DBから取ってきて必要なものだけ使う
      return todos.map( todo => ( {
        id: todo.id,
        title: todo.title,
        completed: todo.completed
      } ) );

    }
  },

  Mutation: { // Mutationはcreate(post), update(put), delete(patch)
    //   // 関数名(data: {オブジェクト}) dataは1件のオブジェクト
    // addTodo: ( _: typeTodo, { title }: { title: string } ): typeTodo => {
    //   const newTodo: typeTodo = {
    //     id: String( todos.length + 1 ),
    //     title,
    //     completed: false,
    //   };

    //   todos.push( newTodo );
    //   return newTodo;
    // },

    addTodo: async ( _: typeTodo, { title }: { title: string; }, context: Context ): Promise<{ id: number, title: string, completed: boolean; }> => {
      const todo: typeTodo = await context.prismaInstance.todo.create( {
        data: {
          title,
          completed: false
        }
      } );

      return {
        id: todo.id,
        title: todo.title,
        completed: todo.completed
      };

    },

    //   updateTodo: ( _: typeTodo, { id, completed }: { id: string, completed: boolean; } ): typeTodo => {
    //     // console.log(id, typeof id);
    //     const update_todo: typeTodo | undefined = todos.find( ( todo: typeTodo ): boolean => todo.id === id );
    //     // console.log(update_todo);

    //     if ( update_todo === undefined ) {
    //       throw new Error( "ありません" );
    //     } else {
    //       update_todo.completed = completed; // 引数で受け取ったcompletedをupdate_todoのプロパティcompletedの値に代入する
    //       return update_todo;
    //     }
    //   },

    updateTodo: async ( _: typeTodo, { id, completed }: { id: number, completed: boolean; }, context: Context ): Promise<{ id: number, completed: boolean; }> => {
      const todo: typeTodo = await context.prismaInstance.todo.update( {
        where: { id },
        data: { completed }
      } );

      return {
        id: todo.id,
        completed: todo.completed,
      };
    },

    //   deleteTodo: ( _: typeTodo, { id }: { id: string; } ): typeTodo => {
    //     const delete_todo_id: number = todos.findIndex( ( todo: typeTodo ): boolean => todo.id === id );

    //     if ( delete_todo_id === -1 ) {
    //       throw new Error( "そのidはありません" );
    //     } else {
    //       // console.log(todos);
    //       console.log( todos[ delete_todo_id ] );
    //       const deleted: typeTodo[] = todos.splice( delete_todo_id, 1 ); // todos[]の中から選択されたインデックスの要素を削除したものを返す
    //       // console.log(deleted); 削除すると選択されたオブジェクトが入った配列(1個)
    //       // console.log(deleted[0]); // 1つだけ入っている配列の要素
    //       return deleted[ 0 ];
    //       // return todos[delete_todo_id];

    //     }
    //   }

    deleteTodo: async ( _: typeTodo, { id }: { id: number; }, context: Context ): Promise<{ id: number, title: string, completed: boolean; }> => {
      const todo: typeTodo = await context.prismaInstance.todo.delete( {
        where: { id }
      } );

      return {
        id: todo.id,
        title: todo.title,
        completed: todo.completed
      };
    }
  }
};
export { typeDefs, resolvers };