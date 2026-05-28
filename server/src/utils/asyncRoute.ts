import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<void> | void;

export function asyncRoute(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
