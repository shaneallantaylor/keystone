import { gql } from 'apollo-server-express';
import { GraphQLResolveInfo } from 'graphql';
import { print } from 'graphql/language/printer';
import { text, relationship } from '@keystone-next/fields';
import { BaseListConfig, KeystoneContext } from '@keystone-next/types';
import { PrismaAdapter } from '@keystone-next/adapter-prisma-legacy';
import { List } from '../ListTypes';
import { AccessDeniedError } from '../ListTypes/graphqlErrors';

const Relationship = relationship({ ref: '' }).type;
const Text = text().type;

const context = {
  getListAccessControlForUser: () => true,
  getFieldAccessControlForUser: (
    access: any,
    listKey: string,
    fieldPath: string,
    originalInput: any,
    existingItem: any
  ) => !(existingItem && existingItem.makeFalse && fieldPath === 'name'),
  getAuthAccessControlForUser: () => true,
} as unknown as KeystoneContext;

// Convert a gql field into a normalised format for comparison.
// Needs to be wrapped in a mock type for gql to correctly parse it.
const normalise = (s: string) => print(gql(`type t { ${s} }`));

const getListByKey = (listKey: string) => {
  if (listKey === 'Other') {
    return {
      // @ts-ignore
      gqlNames: {
        outputTypeName: 'Other',
        createInputName: 'createOther',
        whereInputName: 'OtherWhereInput',
        relateToOneInputName: 'OtherRelateToOneInput',
        whereUniqueInputName: 'OtherWhereUniqueInput',
      },
      access: {
        public: {
          read: true,
        },
      },
    } as unknown as List;
  }
};

class MockFieldImplementation {
  access: any;
  config: any;
  hooks: any;
  constructor() {
    this.access = {
      public: {
        create: false,
        read: true,
        update: false,
        delete: false,
      },
    };
    this.config = {};
    this.hooks = {};
  }
  gqlOutputFields() {
    return ['id: ID'];
  }
  gqlQueryInputFields() {
    return ['id: ID'];
  }
  gqlUpdateInputFields() {
    return ['id: ID'];
  }
  gqlCreateInputFields() {
    return ['id: ID'];
  }
  getGqlAuxTypes() {
    return [];
  }
  getGqlAuxQueries() {
    return [];
  }
  gqlOutputFieldResolvers() {
    return {};
  }
  gqlAuxQueryResolvers() {
    return {};
  }
  gqlAuxFieldResolvers() {
    return {};
  }
  getDefaultValue() {
    return;
  }
  async resolveInput({ resolvedData }: { resolvedData: { id: any } }) {
    return resolvedData.id;
  }
  async validateInput() {}
  async beforeChange() {}
  async afterChange() {}
  async beforeDelete() {}
  async validateDelete() {}
  async afterDelete() {}
}
class MockFieldAdapter {
  listAdapter = { name: 'mock', parentAdapter: {} };
}

const MockIdType = {
  implementation: MockFieldImplementation,
  adapter: MockFieldAdapter,
};

class MockListAdapter {
  name = 'mock';
  parentAdapter: any;
  index: number;
  items: Record<number, Record<string, any> | undefined>;
  constructor(parentAdapter: any) {
    this.parentAdapter = parentAdapter;
    this.index = 3;
    this.items = {
      0: { name: 'a', email: 'a@example.com', id: 0 },
      1: { name: 'b', email: 'b@example.com', id: 1 },
      2: { name: 'c', email: 'c@example.com', id: 2 },
    };
  }
  newFieldAdapter = () => new MockFieldAdapter();
  create = async (item: Record<string, any>) => {
    this.items[this.index] = {
      ...item,
      index: this.index,
    };
    this.index += 1;
    return this.items[this.index - 1];
  };
  delete = async (id: number) => {
    this.items[id] = undefined;
  };
  itemsQuery = async ({ where: { id_in: ids, id, id_not_in } }: any, { meta = false } = {}) => {
    if (meta) {
      return {
        count: (id !== undefined
          ? [this.items[id]]
          : ids
              .filter((i: number) => !id_not_in || !id_not_in.includes(i))
              .map((i: number) => this.items[i])
        ).length,
      };
    } else {
      return id !== undefined
        ? [this.items[id]]
        : ids
            .filter((i: number) => !id_not_in || !id_not_in.includes(i))
            .map((i: number) => this.items[i]);
    }
  };
  update = (id: number, item: Record<string, any>) => {
    this.items[id] = { ...this.items[id], ...item };
    return this.items[id];
  };
}

class MockAdapter {
  name = 'mock';
  newListAdapter = () => new MockListAdapter(this);
}

const listExtras = () => ({
  getListByKey,
  adapter: new MockAdapter() as unknown as PrismaAdapter,
  schemaNames: ['public'],
});

const config = {
  fields: {
    id: { type: MockIdType },
    name: { type: Text },
    email: { type: Text },
    other: { type: Relationship, ref: 'Other' },
    hidden: { type: Text, access: { read: false, create: true, update: true, delete: true } },
    writeOnce: { type: Text, access: { read: true, create: true, update: false, delete: true } },
  },
};

const setup = (extraConfig?: Record<string, any>) => {
  const list = new List(
    'Test',
    { ...config, ...extraConfig } as unknown as BaseListConfig,
    listExtras()
  );
  list.initFields();
  return list;
};

describe('new List()', () => {
  test('new List() - Smoke test', () => {
    const list = setup();
    expect(list).not.toBeNull();
    expect(list.key).toEqual('Test');
    expect(list.getListByKey).toBe(getListByKey);
  });

  test('new List() - Plural throws error', () => {
    expect(() => new List('Tests', config as unknown as BaseListConfig, listExtras())).toThrow(
      Error
    );
  });

  test('new List() - config', () => {
    const list = setup();
    expect(list.fields).toBeInstanceOf(Object);
  });

  test('new List() - labels', () => {
    const list = setup();
    expect(list.adminUILabels).toEqual({
      label: 'Tests',
      singular: 'Test',
      plural: 'Tests',
      path: 'tests',
    });
  });

  test('new List() - gqlNames', () => {
    const list = setup();
    expect(list.gqlNames).toEqual({
      outputTypeName: 'Test',
      itemQueryName: 'Test',
      listQueryName: 'allTests',
      listQueryMetaName: '_allTestsMeta',
      listQueryCountName: 'testsCount',
      listSortName: 'SortTestsBy',
      listOrderName: 'TestOrderByInput',
      deleteMutationName: 'deleteTest',
      deleteManyMutationName: 'deleteTests',
      updateMutationName: 'updateTest',
      createMutationName: 'createTest',
      updateManyMutationName: 'updateTests',
      createManyMutationName: 'createTests',
      whereInputName: 'TestWhereInput',
      whereUniqueInputName: 'TestWhereUniqueInput',
      updateInputName: 'TestUpdateInput',
      createInputName: 'TestCreateInput',
      updateManyInputName: 'TestsUpdateInput',
      createManyInputName: 'TestsCreateInput',
      relateToManyInputName: 'TestRelateToManyInput',
      relateToOneInputName: 'TestRelateToOneInput',
    });
  });

  test('new List() - access', () => {
    const list = setup();
    expect(list.access).toEqual({
      internal: {
        create: true,
        read: true,
        update: true,
        delete: true,
        auth: true,
      },
      public: {
        create: true,
        delete: true,
        read: true,
        update: true,
        auth: true,
      },
    });
  });

  test('new List() - fields', () => {
    const list = setup();
    expect(list.fields).toHaveLength(6);
    expect(list.fields[0]).toBeInstanceOf(MockIdType.implementation);
    expect(list.fields[1]).toBeInstanceOf(Text.implementation);
    expect(list.fields[2]).toBeInstanceOf(Text.implementation);
    expect(list.fields[3]).toBeInstanceOf(Relationship.implementation);
    expect(list.fields[4]).toBeInstanceOf(Text.implementation);
    expect(list.fields[5]).toBeInstanceOf(Text.implementation);

    expect(list.fieldsByPath['id']).toBeInstanceOf(MockIdType.implementation);
    expect(list.fieldsByPath['name']).toBeInstanceOf(Text.implementation);
    expect(list.fieldsByPath['email']).toBeInstanceOf(Text.implementation);
    expect(list.fieldsByPath['other']).toBeInstanceOf(Relationship.implementation);
    expect(list.fieldsByPath['hidden']).toBeInstanceOf(Text.implementation);
    expect(list.fieldsByPath['writeOnce']).toBeInstanceOf(Text.implementation);

    const idOnlyList = new List(
      'NoField',
      { fields: { id: { type: MockIdType } }, access: {} },
      listExtras()
    );
    idOnlyList.initFields();
    expect(idOnlyList.fields).toHaveLength(1);
    expect(list.fields[0]).toBeInstanceOf(MockIdType.implementation);
    expect(list.fieldsByPath['id']).toBeInstanceOf(MockIdType.implementation);
  });

  test('new List() - adapter', () => {
    const list = setup();
    expect(list.adapter).toBeInstanceOf(MockListAdapter);
  });
});

describe(`getGqlTypes()`, () => {
  const type = `""" A keystone list """
      type Test {
        id: ID
        name: String
        email: String
        other: Other
        writeOnce: String
      }`;
  const whereInput = `input TestWhereInput {
        AND: [TestWhereInput]
        OR: [TestWhereInput]
        id: ID
        name: String
        name_not: String
        name_contains: String
        name_not_contains: String
        name_starts_with: String
        name_not_starts_with: String
        name_ends_with: String
        name_not_ends_with: String
        name_i: String
        name_not_i: String
        name_contains_i: String
        name_not_contains_i: String
        name_starts_with_i: String
        name_not_starts_with_i: String
        name_ends_with_i: String
        name_not_ends_with_i: String
        name_in: [String]
        name_not_in: [String]
        email: String
        email_not: String
        email_contains: String
        email_not_contains: String
        email_starts_with: String
        email_not_starts_with: String
        email_ends_with: String
        email_not_ends_with: String
        email_i: String
        email_not_i: String
        email_contains_i: String
        email_not_contains_i: String
        email_starts_with_i: String
        email_not_starts_with_i: String
        email_ends_with_i: String
        email_not_ends_with_i: String
        email_in: [String]
        email_not_in: [String]
        other: OtherWhereInput
        other_is_null: Boolean
        writeOnce: String
        writeOnce_not: String
        writeOnce_contains: String
        writeOnce_not_contains: String
        writeOnce_starts_with: String
        writeOnce_not_starts_with: String
        writeOnce_ends_with: String
        writeOnce_not_ends_with: String
        writeOnce_i: String
        writeOnce_not_i: String
        writeOnce_contains_i: String
        writeOnce_not_contains_i: String
        writeOnce_starts_with_i: String
        writeOnce_not_starts_with_i: String
        writeOnce_ends_with_i: String
        writeOnce_not_ends_with_i: String
        writeOnce_in: [String]
        writeOnce_not_in: [String]
      }`;
  const whereUniqueInput = `input TestWhereUniqueInput {
        id: ID!
      }`;
  const updateInput = `input TestUpdateInput {
        name: String
        email: String
        other: OtherRelateToOneInput
        hidden: String
      }`;
  const updateManyInput = `input TestsUpdateInput {
        id: ID!
        data: TestUpdateInput
      }`;
  const createInput = `input TestCreateInput {
        name: String
        email: String
        other: OtherRelateToOneInput
        hidden: String
        writeOnce: String
      }`;
  const createManyInput = `input TestsCreateInput {
        data: TestCreateInput
      }`;
  const sortTestsBy = `enum SortTestsBy {
        name_ASC
        name_DESC
        email_ASC
        email_DESC
        writeOnce_ASC
        writeOnce_DESC
      }`;
  const orderTestsBy = `input TestOrderByInput {
       name: OrderDirection
       email: OrderDirection
       writeOnce: OrderDirection
      }`;
  const orderDirection = `enum OrderDirection { asc desc }`;
  const otherRelateToOneInput = `input OtherRelateToOneInput {
    connect: OtherWhereUniqueInput
    disconnect: OtherWhereUniqueInput
    disconnectAll: Boolean
  }`;
  const schemaName = 'public';
  test('access: true', () => {
    expect(
      setup({ access: true })
        .getGqlTypes({ schemaName })
        .map(s => print(gql(s)))
    ).toEqual(
      [
        otherRelateToOneInput,
        type,
        whereInput,
        whereUniqueInput,
        sortTestsBy,
        orderTestsBy,
        orderDirection,
        updateInput,
        updateManyInput,
        createInput,
        createManyInput,
      ].map(s => print(gql(s)))
    );
  });
  test('access: false', () => {
    expect(
      setup({ access: false })
        .getGqlTypes({ schemaName })
        .map(s => print(gql(s)))
    ).toEqual([]);
  });
  test('read: true', () => {
    expect(
      setup({ access: { read: true, create: false, update: false, delete: false } })
        .getGqlTypes({ schemaName })
        .map(s => print(gql(s)))
    ).toEqual(
      [
        otherRelateToOneInput,
        type,
        whereInput,
        whereUniqueInput,
        sortTestsBy,
        orderTestsBy,
        orderDirection,
      ].map(s => print(gql(s)))
    );
  });
  test('create: true', () => {
    expect(
      setup({ access: { read: false, create: true, update: false, delete: false } })
        .getGqlTypes({ schemaName })
        .map(s => print(gql(s)))
    ).toEqual(
      [
        otherRelateToOneInput,
        type,
        whereInput,
        whereUniqueInput,
        sortTestsBy,
        orderTestsBy,
        orderDirection,
        createInput,
        createManyInput,
      ].map(s => print(gql(s)))
    );
  });
  test('update: true', () => {
    expect(
      setup({ access: { read: false, create: false, update: true, delete: false } })
        .getGqlTypes({ schemaName })
        .map(s => print(gql(s)))
    ).toEqual(
      [
        otherRelateToOneInput,
        type,
        whereInput,
        whereUniqueInput,
        sortTestsBy,
        orderTestsBy,
        orderDirection,
        updateInput,
        updateManyInput,
      ].map(s => print(gql(s)))
    );
  });
  test('delete: true', () => {
    expect(
      setup({ access: { read: false, create: false, update: false, delete: true } })
        .getGqlTypes({ schemaName })
        .map(s => print(gql(s)))
    ).toEqual(
      [
        otherRelateToOneInput,
        type,
        whereInput,
        whereUniqueInput,
        sortTestsBy,
        orderTestsBy,
        orderDirection,
      ].map(s => print(gql(s)))
    );
  });
});

test('getGraphqlFilterFragment', () => {
  const list = setup();
  expect(list.getGraphqlFilterFragment()).toEqual([
    'where: TestWhereInput! = {}',
    'search: String',
    'sortBy: [SortTestsBy!] @deprecated(reason: "sortBy has been deprecated in favour of orderBy")',
    'orderBy: [TestOrderByInput!]! = []',
    'first: Int',
    'skip: Int! = 0',
  ]);
});

describe(`getGqlQueries()`, () => {
  const schemaName = 'public';
  test('access: true', () => {
    expect(setup({ access: true }).getGqlQueries({ schemaName }).map(normalise)).toEqual(
      [
        `""" Search for all Test items which match the where clause. """
          allTests(
          where: TestWhereInput! = {}
          search: String
          sortBy: [SortTestsBy!] @deprecated(reason: "sortBy has been deprecated in favour of orderBy")
          orderBy: [TestOrderByInput!]! = []
          first: Int
          skip: Int! = 0
        ): [Test!]`,
        `""" Search for the Test item with the matching ID. """
          Test(
          where: TestWhereUniqueInput!
        ): Test`,
        `""" Perform a meta-query on all Test items which match the where clause. """
          _allTestsMeta(
          where: TestWhereInput! = {}
          search: String
          sortBy: [SortTestsBy!] @deprecated(reason: "sortBy has been deprecated in favour of orderBy")
          orderBy: [TestOrderByInput!]! = []
          first: Int
          skip: Int! = 0
        ): _QueryMeta @deprecated(reason: \"This query will be removed in a future version. Please use testsCount instead.\")`,
        `testsCount(where: TestWhereInput! = {}): Int`,
      ].map(normalise)
    );
  });
  test('access: false', () => {
    expect(setup({ access: false }).getGqlQueries({ schemaName }).map(normalise)).toEqual([]);
  });
});

test('_wrapFieldResolverWith', async () => {
  const resolver = () => 'result';
  const list = setup();
  const newResolver = list._wrapFieldResolver(list.fieldsByPath['name'], resolver);
  await expect(newResolver({}, {}, context, {} as GraphQLResolveInfo)).resolves.toEqual('result');
  await expect(
    newResolver({ makeFalse: true }, {}, context, {} as GraphQLResolveInfo)
  ).rejects.toThrow(AccessDeniedError);
});

test('gqlFieldResolvers', () => {
  const schemaName = 'public';
  const resolvers = setup().gqlFieldResolvers({ schemaName });
  expect(resolvers.Test.email).toBeInstanceOf(Function);
  expect(resolvers.Test.name).toBeInstanceOf(Function);
  expect(resolvers.Test.other).toBeInstanceOf(Function);
  expect(resolvers.Test.writeOnce).toBeInstanceOf(Function);
  expect(resolvers.Test.hidden).toBe(undefined);

  expect(setup({ access: false }).gqlFieldResolvers({ schemaName })).toEqual({});
});

test('gqlAuxFieldResolvers', () => {
  const list = setup();
  const schemaName = 'public';
  expect(list.gqlAuxFieldResolvers({ schemaName })).toEqual({});
});

test('gqlAuxQueryResolvers', () => {
  const list = setup();
  expect(list.gqlAuxQueryResolvers()).toEqual({});
});

describe(`getGqlMutations()`, () => {
  const extraConfig = {};
  const schemaName = 'public';
  test('access: true', () => {
    expect(
      setup({ access: true, ...extraConfig })
        .getGqlMutations({ schemaName })
        .map(normalise)
    ).toEqual(
      [
        `""" Create a single Test item. """ createTest(data: TestCreateInput): Test`,
        `""" Create multiple Test items. """ createTests(data: [TestsCreateInput]): [Test]`,
        `""" Update a single Test item by ID. """ updateTest(id: ID! data: TestUpdateInput): Test`,
        `""" Update multiple Test items by ID. """ updateTests(data: [TestsUpdateInput]): [Test]`,
        `""" Delete a single Test item by ID. """ deleteTest(id: ID!): Test`,
        `""" Delete multiple Test items by ID. """ deleteTests(ids: [ID!]): [Test]`,
      ].map(normalise)
    );
  });
  test('access: false', () => {
    expect(
      setup({ access: false, ...extraConfig })
        .getGqlMutations({ schemaName })
        .map(normalise)
    ).toEqual([]);
  });
  test('read: true', () => {
    expect(
      setup({
        access: { read: true, create: false, update: false, delete: false },
        ...extraConfig,
      })
        .getGqlMutations({ schemaName })
        .map(normalise)
    ).toEqual([].map(normalise));
  });
  test('create: true', () => {
    expect(
      setup({
        access: { read: false, create: true, update: false, delete: false },
        ...extraConfig,
      })
        .getGqlMutations({ schemaName })
        .map(normalise)
    ).toEqual(
      [
        `""" Create a single Test item. """ createTest(data: TestCreateInput): Test`,
        `""" Create multiple Test items. """ createTests(data: [TestsCreateInput]): [Test]`,
      ].map(normalise)
    );
  });
  test('update: true', () => {
    expect(
      setup({
        access: { read: false, create: false, update: true, delete: false },
        ...extraConfig,
      })
        .getGqlMutations({ schemaName })
        .map(normalise)
    ).toEqual(
      [
        `""" Update a single Test item by ID. """ updateTest(id: ID! data: TestUpdateInput): Test`,
        `""" Update multiple Test items by ID. """ updateTests(data: [TestsUpdateInput]): [Test]`,
      ].map(normalise)
    );
  });
  test('delete: true', () => {
    expect(
      setup({
        access: { read: false, create: false, update: false, delete: true },
        ...extraConfig,
      })
        .getGqlMutations({ schemaName })
        .map(normalise)
    ).toEqual(
      [
        `""" Delete a single Test item by ID. """ deleteTest(id: ID!): Test`,
        `""" Delete multiple Test items by ID. """ deleteTests(ids: [ID!]): [Test]`,
      ].map(normalise)
    );
  });
});

test('checkFieldAccess', async () => {
  const list = setup();
  list.checkFieldAccess(
    'read',
    [{ existingItem: {}, data: { name: 'a', email: 'a@example.com' } }],
    context,
    {
      gqlName: 'testing',
    }
  );
  await expect(
    list.checkFieldAccess(
      'read',
      [{ existingItem: { makeFalse: true }, data: { name: 'a', email: 'a@example.com' } }],
      context,
      { gqlName: '' }
    )
  ).rejects.toThrow(AccessDeniedError);
  let thrownError;
  try {
    await list.checkFieldAccess(
      'read',
      [{ existingItem: { makeFalse: true }, data: { name: 'a', email: 'a@example.com' } }],
      context,
      { gqlName: 'testing', extra: 1 }
    );
  } catch (error) {
    thrownError = error;
  }
  expect(thrownError.data).toEqual({
    restrictedFields: ['name'],
    target: 'testing',
    type: 'query',
  });
  expect(thrownError.internalData).toEqual({ extra: 1 });
});

test('checkListAccess', async () => {
  const list = setup();
  const originalInput = {};
  await expect(
    list.checkListAccess(context, originalInput, 'read', { gqlName: 'testing' })
  ).resolves.toEqual(true);

  const newContext = {
    ...context,
    getListAccessControlForUser: (
      access: any,
      listKey: string,
      originalInput: any,
      operation: string
    ) => operation === 'update',
  };
  await expect(
    list.checkListAccess(newContext, originalInput, 'update', { gqlName: 'testing' })
  ).resolves.toEqual(true);
  await expect(
    list.checkListAccess(newContext, originalInput, 'read', { gqlName: 'testing' })
  ).rejects.toThrow(AccessDeniedError);
});

test('getAccessControlledItem', async () => {
  const list = setup();
  expect(
    await list.getAccessControlledItem(1, true, { context, operation: 'read', gqlName: 'testing' })
  ).toEqual({
    name: 'b',
    email: 'b@example.com',
    id: 1,
  });
  await expect(
    list.getAccessControlledItem(10, true, { context, operation: 'read', gqlName: 'testing' })
  ).rejects.toThrow(AccessDeniedError);

  expect(
    await list.getAccessControlledItem(
      1,
      { id: 1 },
      { context, operation: 'read', gqlName: 'testing' }
    )
  ).toEqual({
    name: 'b',
    email: 'b@example.com',
    id: 1,
  });
  await expect(
    list.getAccessControlledItem(1, { id: 2 }, { context, operation: 'read', gqlName: 'testing' })
  ).rejects.toThrow(AccessDeniedError);

  expect(
    await list.getAccessControlledItem(
      1,
      { id_not: 2 },
      { context, operation: 'read', gqlName: 'testing' }
    )
  ).toEqual({
    name: 'b',
    email: 'b@example.com',
    id: 1,
  });
  await expect(
    list.getAccessControlledItem(
      1,
      { id_not: 1 },
      { context, operation: 'read', gqlName: 'testing' }
    )
  ).rejects.toThrow(AccessDeniedError);

  expect(
    await list.getAccessControlledItem(
      1,
      { id_in: [1, 2] },
      { context, operation: 'read', gqlName: 'testing' }
    )
  ).toEqual({
    name: 'b',
    email: 'b@example.com',
    id: 1,
  });
  await expect(
    list.getAccessControlledItem(
      1,
      { id_in: [2, 3] },
      { context, operation: 'read', gqlName: 'testing' }
    )
  ).rejects.toThrow(AccessDeniedError);

  expect(
    await list.getAccessControlledItem(
      1,
      { id_not_in: [2, 3] },
      { context, operation: 'read', gqlName: 'testing' }
    )
  ).toEqual({
    name: 'b',
    email: 'b@example.com',
    id: 1,
  });
  await expect(
    list.getAccessControlledItem(
      1,
      { id_not_in: [1, 2] },
      { context, operation: 'read', gqlName: 'testing' }
    )
  ).rejects.toThrow(AccessDeniedError);
});

test('getAccessControlledItems', async () => {
  const list = setup();
  expect(await list.getAccessControlledItems([], true)).toEqual([]);
  expect(await list.getAccessControlledItems([1, 2], true)).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
    { name: 'c', email: 'c@example.com', id: 2 },
  ]);
  expect(await list.getAccessControlledItems([1, 2, 1, 2], true)).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
    { name: 'c', email: 'c@example.com', id: 2 },
  ]);

  expect(await list.getAccessControlledItems([1, 2], { id: 1 })).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
  ]);
  expect(await list.getAccessControlledItems([1, 2], { id: 3 })).toEqual([]);

  expect(await list.getAccessControlledItems([1, 2], { id_in: [1, 2, 3] })).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
    { name: 'c', email: 'c@example.com', id: 2 },
  ]);
  expect(await list.getAccessControlledItems([1, 2], { id_in: [2, 3] })).toEqual([
    { name: 'c', email: 'c@example.com', id: 2 },
  ]);
  expect(await list.getAccessControlledItems([1, 2], { id_in: [3, 4] })).toEqual([]);

  expect(await list.getAccessControlledItems([1, 2], { id_not: 2 })).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
  ]);
  expect(await list.getAccessControlledItems([1, 2], { id_not: 3 })).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
    { name: 'c', email: 'c@example.com', id: 2 },
  ]);

  expect(await list.getAccessControlledItems([1, 2], { id_not_in: [1, 2, 3] })).toEqual([]);
  expect(await list.getAccessControlledItems([1, 2], { id_not_in: [2, 3] })).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
  ]);
  expect(await list.getAccessControlledItems([1, 2], { id_not_in: [3, 4] })).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
    { name: 'c', email: 'c@example.com', id: 2 },
  ]);
});

test(`gqlQueryResolvers`, () => {
  const schemaName = 'public';
  const resolvers = setup({ access: true }).gqlQueryResolvers({ schemaName });
  expect(resolvers['allTests']).toBeInstanceOf(Function); // listQueryName
  expect(resolvers['_allTestsMeta']).toBeInstanceOf(Function); // listQueryMetaName
  expect(resolvers['Test']).toBeInstanceOf(Function); // itemQueryName

  const resolvers2 = setup({ access: false }).gqlQueryResolvers({ schemaName });
  expect(resolvers2['allTests']).toBe(undefined); // listQueryName
  expect(resolvers2['_allTestsMeta']).toBe(undefined); // listQueryMetaName
  expect(resolvers2['Test']).toBe(undefined); // itemQueryName
});

test('listQuery', async () => {
  const list = setup();
  expect(await list.listQuery({ where: { id: 1 } }, context, 'testing', undefined)).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
  ]);
});

test('listQueryMeta', async () => {
  const list = setup();
  expect(
    await (await list.listQueryMeta({ where: { id: 1 } }, context, 'testing', undefined)).getCount()
  ).toEqual(1);
  expect(
    await (
      await list.listQueryMeta({ where: { id_in: [1, 2] } }, context, 'testing', undefined)
    ).getCount()
  ).toEqual(2);
});

test('itemQuery', async () => {
  const list = setup();
  expect(await list.itemQuery({ where: { id: '0' } }, context)).toEqual({
    name: 'a',
    email: 'a@example.com',
    id: 0,
  });
  await expect(list.itemQuery({ where: { id: '4' } }, context)).rejects.toThrow(AccessDeniedError);
});

describe(`gqlMutationResolvers`, () => {
  const schemaName = 'public';
  let resolvers;
  test('access: true', () => {
    resolvers = setup({ access: true }).gqlMutationResolvers({ schemaName });
    expect(resolvers['createTest']).toBeInstanceOf(Function);
    expect(resolvers['updateTest']).toBeInstanceOf(Function);
    expect(resolvers['deleteTest']).toBeInstanceOf(Function);
    expect(resolvers['deleteTests']).toBeInstanceOf(Function);
  });
  test('access: false', () => {
    resolvers = setup({ access: false }).gqlMutationResolvers({ schemaName });
    expect(resolvers['authenticateTestWithPassword']).toBe(undefined);
    expect(resolvers['unauthenticateTest']).toBe(undefined);
    expect(resolvers['updateAuthenticatedTest']).toBe(undefined);
  });
  test('read: true', () => {
    resolvers = setup({
      access: { read: true, create: false, update: false, delete: false },
    }).gqlMutationResolvers({ schemaName });
  });
  test('create: true', () => {
    resolvers = setup({
      access: { read: false, create: true, update: false, delete: false },
    }).gqlMutationResolvers({ schemaName });
    expect(resolvers['createTest']).toBeInstanceOf(Function);
    expect(resolvers['updateTest']).toBe(undefined);
    expect(resolvers['deleteTest']).toBe(undefined);
    expect(resolvers['deleteTests']).toBe(undefined);
  });
  test('update: true', () => {
    resolvers = setup({
      access: { read: false, create: false, update: true, delete: false },
    }).gqlMutationResolvers({ schemaName });
    expect(resolvers['createTest']).toBe(undefined);
    expect(resolvers['updateTest']).toBeInstanceOf(Function);
    expect(resolvers['deleteTest']).toBe(undefined);
    expect(resolvers['deleteTests']).toBe(undefined);
  });
  test('delete: true', () => {
    resolvers = setup({
      access: { read: false, create: false, update: false, delete: true },
    }).gqlMutationResolvers({ schemaName });
    expect(resolvers['createTest']).toBe(undefined);
    expect(resolvers['updateTest']).toBe(undefined);
    expect(resolvers['deleteTest']).toBeInstanceOf(Function);
    expect(resolvers['deleteTests']).toBeInstanceOf(Function);
  });
});

test('createMutation', async () => {
  const list = setup();
  const result = await list.createMutation({ name: 'test', email: 'test@example.com' }, context);
  expect(result).toEqual({ name: 'test', email: 'test@example.com', index: 3 });
});

test('createManyMutation', async () => {
  const list = setup();
  const result = await Promise.all(
    await list.createManyMutation(
      [
        { data: { name: 'test1', email: 'test1@example.com' } },
        { data: { name: 'test2', email: 'test2@example.com' } },
      ],
      context
    )
  );
  expect(result).toEqual([
    { name: 'test1', email: 'test1@example.com', index: 3 },
    { name: 'test2', email: 'test2@example.com', index: 4 },
  ]);
});

test('updateMutation', async () => {
  const list = setup();
  const result = await list.updateMutation(
    1,
    { name: 'update', email: 'update@example.com' },
    context
  );
  expect(result).toEqual({ name: 'update', email: 'update@example.com', id: 1 });
});

test('updateManyMutation', async () => {
  const list = setup();
  const result = await Promise.all(
    await list.updateManyMutation(
      [
        { id: 1, data: { name: 'update1', email: 'update1@example.com' } },
        { id: 2, data: { email: 'update2@example.com' } },
      ],
      context
    )
  );
  expect(result).toEqual([
    { name: 'update1', email: 'update1@example.com', id: 1 },
    { name: 'c', email: 'update2@example.com', id: 2 },
  ]);
});

test('deleteMutation', async () => {
  const list = setup();
  const result = await list.deleteMutation(1, context);
  expect(result).toEqual({ name: 'b', email: 'b@example.com', id: 1 });
});

test('deleteManyMutation', async () => {
  const list = setup();
  const result = await Promise.all(await list.deleteManyMutation([1, 2], context));
  expect(result).toEqual([
    { name: 'b', email: 'b@example.com', id: 1 },
    { name: 'c', email: 'c@example.com', id: 2 },
  ]);
});

describe('List Hooks', () => {
  describe('change mutation', () => {
    test('provides the expected list API', () => {
      return Promise.all(
        [
          (list: List) => list.createMutation({ name: 'test', email: 'test@example.com' }, context),
          (list: List) =>
            list.updateMutation(1, { name: 'update', email: 'update@example.com' }, context),
        ].map(async action => {
          const hooks = {
            resolveInput: jest.fn(({ resolvedData }) => resolvedData),
            validateInput: jest.fn(),
            beforeChange: jest.fn(),
            afterChange: jest.fn(),
          };
          const list = setup({ hooks });
          await action(list);

          Object.keys(hooks).forEach(hook => {
            // @ts-ignore
            expect(hooks[hook]).toHaveBeenCalledWith(expect.objectContaining({}));
          });
        })
      );
    });
  });

  describe('delete mutation', () => {
    test('provides the expected list API', async () => {
      const hooks = {
        validateDelete: jest.fn(),
        beforeDelete: jest.fn(),
        afterDelete: jest.fn(),
      };
      const list = setup({ hooks });
      await list.deleteMutation(1, context);

      Object.keys(hooks).forEach(hook => {
        // @ts-ignore
        expect(hooks[hook]).toHaveBeenCalledWith(expect.objectContaining({}));
      });
    });
  });
});