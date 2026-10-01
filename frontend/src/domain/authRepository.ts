import type { User } from "./user";

// ログイン / サインアップはトークンが**レスポンスヘッダ**で返るので、
// 本人と一緒にトークンも返す。保存先を決めるのは Core/authSession の仕事。
export type Authenticated = {
  user: User;
  token: string;
};

export type AuthRepository = {
  login(input: { email: string; password: string }): Promise<Authenticated>;
  signup(input: { name: string; email: string; password: string }): Promise<Authenticated>;
  logout(): Promise<void>;
  me(): Promise<User>;
};
