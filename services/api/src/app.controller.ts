import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      service: "adeyapp-api",
      status: "ok"
    };
  }
}
