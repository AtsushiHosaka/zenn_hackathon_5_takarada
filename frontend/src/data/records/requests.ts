// リクエストボディ。Rails の params.require(:user) に合わせた入れ子も生成物が持っている。
import type { components } from "../generated/api";

export type SignupInput = components["schemas"]["SignupInput"];
export type LoginInput = components["schemas"]["LoginInput"];
export type UserInput = components["schemas"]["UserInput"];
