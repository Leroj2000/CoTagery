import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'require_module';

/**
 * Označí controller nebo endpoint jako součást volitelného modulu / funkce
 * předplatného. Více klíčů = musí být aktivní všechny. Metoda přebíjí třídu.
 */
export const RequireModule = (...moduleKeys: string[]): CustomDecorator =>
  SetMetadata(REQUIRE_MODULE_KEY, moduleKeys);
