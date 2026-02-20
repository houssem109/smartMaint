import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'SmartMaint AI Backend API is running!';
  }
}
