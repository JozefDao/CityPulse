import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';

type ErrorPayload = {
  statusCode: number;
  errorCode: string;
  message: string;
  path: string;
  timestamp: string;
  details?: unknown;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.originalUrl ?? request.url;

    if (exception instanceof ThrottlerException) {
      const payload: ErrorPayload = {
        statusCode: 429,
        errorCode: 'RATE_LIMITED',
        message: exception.message ?? 'Too many requests',
        path,
        timestamp,
      };
      return response.status(429).json(payload);
    }

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code
    ) {
      if (exception.code === 'P2002') {
        const payload: ErrorPayload = {
          statusCode: HttpStatus.CONFLICT,
          errorCode: 'DB_UNIQUE_CONSTRAINT',
          message: 'Unique constraint failed',
          path,
          timestamp,
          details: exception.meta,
        };
        return response.status(HttpStatus.CONFLICT).json(payload);
      }
      if (exception.code === 'P2025') {
        const payload: ErrorPayload = {
          statusCode: HttpStatus.NOT_FOUND,
          errorCode: 'DB_NOT_FOUND',
          message: 'Record not found',
          path,
          timestamp,
          details: exception.meta,
        };
        return response.status(HttpStatus.NOT_FOUND).json(payload);
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as
        | string
        | {
            message?: string | string[];
            error?: string;
            [key: string]: unknown;
          };

      let message = exception.message ?? 'Request failed';
      let details: unknown;

      if (typeof res === 'string') {
        message = res;
      } else if (res?.message) {
        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          details = res.message;
        } else {
          message = res.message;
        }
      }

      const payload: ErrorPayload = {
        statusCode: status,
        errorCode:
          res && typeof res === 'object' && res.error
            ? String(res.error)
            : 'HTTP_ERROR',
        message,
        path,
        timestamp,
        details,
      };
      return response.status(status).json(payload);
    }

    const payload: ErrorPayload = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error',
      path,
      timestamp,
    };
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}
