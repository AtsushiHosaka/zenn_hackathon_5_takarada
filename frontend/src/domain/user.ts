export type UserId = number;

export type User = {
  id: UserId;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};
