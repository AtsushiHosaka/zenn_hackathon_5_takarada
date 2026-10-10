export type UserId = number;

export type User = {
  id: UserId;
  name: string;
  email: string;
  // 家具・商品の管理画面 (/admin) を使えるか
  admin: boolean;
  createdAt: Date;
  updatedAt: Date;
};
