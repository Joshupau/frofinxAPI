declare module 'jsonwebtoken-promisified' {
  const jsonwebtokenPromisified: {
    verify(token: string, key: string, options?: any): Promise<any>;
    sign(payload: any, key: string, options?: any): Promise<string>;
    decode?(token: string, options?: any): any;
  };
  export default jsonwebtokenPromisified;
}
