import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = 
      exception instanceof HttpException
        ? exception.message
        : '服务器内部错误';

    const responseBody = {
      code: status === HttpStatus.OK ? 0 : -1,
      msg: message,
      data: exception instanceof HttpException ? exception.getResponse() : null,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(`${request.method} ${request.url} - ${status} - ${message}`);
    
    response.status(status).json(responseBody);
  }
} 