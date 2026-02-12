-- Ejecutar en el SQL Editor de tu proyecto Supabase
-- Tabla para participantes del evento Valentine (Contabilidad según la Conciencia)
-- Registro en 2 pasos: paso 1 = nombre (INSERT); paso 2 = fecha, carrera, genero, signo (UPDATE).

CREATE TABLE participantes_valentine (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_par TEXT NOT NULL,
  sujeto TEXT NOT NULL,
  nombre TEXT NOT NULL,
  fecha_nacimiento DATE,
  carrera TEXT,
  genero TEXT,
  signo_zodiacal TEXT,
  respuestas JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Realtime para la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE participantes_valentine;

-- Si la tabla ya existe, añadir columnas:
-- ALTER TABLE participantes_valentine ADD COLUMN IF NOT EXISTS codigo_par TEXT;
-- ALTER TABLE participantes_valentine ADD COLUMN IF NOT EXISTS sujeto TEXT;
-- ALTER TABLE participantes_valentine ADD COLUMN IF NOT EXISTS signo_zodiacal TEXT;
-- ALTER TABLE participantes_valentine ADD COLUMN IF NOT EXISTS respuestas JSONB DEFAULT '{}';

-- Si la tabla ya existe con NOT NULL en estos campos, permitir NULL para el registro en 2 pasos:
-- ALTER TABLE participantes_valentine ALTER COLUMN fecha_nacimiento DROP NOT NULL;
-- ALTER TABLE participantes_valentine ALTER COLUMN carrera DROP NOT NULL;
-- ALTER TABLE participantes_valentine ALTER COLUMN genero DROP NOT NULL;
