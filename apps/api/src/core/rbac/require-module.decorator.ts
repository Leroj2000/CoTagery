import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'require_module';

/** Označí controller nebo endpoint jako součást volitelného produktového modulu. */
export const RequireModule = (moduleKey: string): CustomDecorator =>
  SetMetadata(REQUIRE_MODULE_KEY, moduleKey);
