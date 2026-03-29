import { SetMetadata } from "@nestjs/common";

export const SENSITIVE_KEY = "sensitiveOperation";
export const Sensitive = () => SetMetadata(SENSITIVE_KEY, true);
