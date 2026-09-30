declare module "robots-parser" {
  interface Robot {
    isAllowed(url: string, userAgent?: string): boolean | undefined;
    isDisallowed(url: string, userAgent?: string): boolean | undefined;
  }
  function robotsParser(url: string, contents: string): Robot;
  export = robotsParser;
}
