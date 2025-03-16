export interface IAPIResponse<T> {
  code: number;
  message: string;
  data: T;
}