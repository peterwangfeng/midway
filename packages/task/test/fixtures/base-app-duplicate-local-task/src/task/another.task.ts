import { App, Provide, TaskLocal } from '@midwayjs/decorator';
import { Application } from "@midwayjs/koa";

@Provide()
export class HelloTask {

  @App()
  app: Application;

  @TaskLocal('*/2 * * * * *')
  async hello() {
    this.app.getApplicationContext().registerObject(`name`, 'taskLocal');
  }
}
