-- База второго филиала (Asdem 2). Выполняется только при создании пустого тома MariaDB.
CREATE DATABASE IF NOT EXISTS crm_dordoi;
GRANT ALL PRIVILEGES ON crm_dordoi.* TO 'crm'@'%';
