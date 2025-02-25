import { createApp, close } from '@midwayjs/mock';
import { Framework, IMidwayKoaApplication } from '@midwayjs/koa';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { UserService } from './fixtures/sequelize-new/src/service/user';

function cleanFile(file) {
  if (existsSync(file)) {
    unlinkSync(file);
  }
}

describe('/test/index.test.ts', () => {
  let app: IMidwayKoaApplication;
  beforeAll(async () => {
    cleanFile(join(__dirname, 'fixtures/sequelize-new', 'database.sqlite'));
    app = await createApp(
      join(__dirname, 'fixtures', 'sequelize-new'),
      {},
      Framework
    );
  });

  afterAll(async () => {
    await close(app);
  });
  it('list user service ', async () => {
    const userService: UserService = await app
      .getApplicationContext()
      .getAsync(UserService);
    const result = await userService.list();
    expect(result.length).toBe(0);
  });

  it('list hello service ', async () => {
    const userService: UserService = await app
      .getApplicationContext()
      .getAsync(UserService);
    const result = await userService.listHello();
    expect(result.length).toBe(0);
  });

  it('add and delete', async () => {
    const userService: UserService = await app
      .getApplicationContext()
      .getAsync(UserService);
    await userService.add();
    let result = await userService.list();
    expect(result.length).toBe(1);
    await userService.delete();
    result = await userService.list();
    expect(result.length).toBe(0);
  });
});
