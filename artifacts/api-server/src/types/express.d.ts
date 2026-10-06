export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        hospitalName: string;
        role: "ADMIN" | "HOSPITAL_MANAGER" | "STAFF";
      };
    }
  }
}
