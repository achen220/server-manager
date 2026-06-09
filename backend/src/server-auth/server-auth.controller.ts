import { Controller } from '@nestjs/common';

@Controller()
export class ServerAuthController {
  constructor(private readonly authService: ServerAuthController) {}
}
