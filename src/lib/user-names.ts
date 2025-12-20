import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
// Статический импорт JSON файла для работы в serverless окружении
import userNamesData from "@/app/api/user-names.json";

// Используем путь относительно корня проекта
// В Next.js это должно работать как в dev, так и в production
const NAMES_FILE_PATH = join(process.cwd(), "src/app/api/user-names.json");
const NAMES_SOURCE_PATH = join(process.cwd(), "names.md");

// Кэш для списка имен из names.md
let availableNamesCache: string[] | null = null;

/**
 * Получает список доступных имен из names.md
 */
function getAvailableNames(): string[] {
  if (availableNamesCache) {
    return availableNamesCache;
  }

  try {
    const content = readFileSync(NAMES_SOURCE_PATH, "utf-8");
    const names = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    availableNamesCache = names;
    return names;
  } catch (error) {
    console.error("Error reading names.md:", error);
    // Fallback на базовый список если файл не найден
    return [
      "Пилипич",
      "Гнатич",
      "Семенич",
      "Опанасич",
      "Трохимич",
      "Харитонич",
      "Кіндратич",
      "Якимович",
      "Демидич",
      "Тарасостан",
    ];
  }
}

/**
 * Читает маппинг userId -> имя из JSON файла
 * Использует статический импорт для serverless окружения, fallback на чтение файла
 */
function readNamesFile(): Record<string, string> {
  try {
    // Сначала пытаемся использовать статически импортированные данные
    // Это работает в serverless окружении, где файл включен в bundle
    if (userNamesData && typeof userNamesData === "object") {
      return userNamesData as Record<string, string>;
    }
  } catch (importError) {
    // Если статический импорт не сработал, пробуем прочитать файл
  }

  try {
    if (!existsSync(NAMES_FILE_PATH)) {
      // Создаем пустой файл если его нет (только если файловая система доступна для записи)
      try {
        writeFileSync(NAMES_FILE_PATH, JSON.stringify({}, null, 2), "utf-8");
      } catch (writeError) {
        // В serverless окружении файловая система может быть read-only
        // Это нормально, просто возвращаем пустой объект
      }
      return {};
    }

    const content = readFileSync(NAMES_FILE_PATH, "utf-8");
    const data = JSON.parse(content);
    return typeof data === "object" && data !== null ? data : {};
  } catch (error) {
    console.error("Error reading user-names.json:", error);
    return {};
  }
}

/**
 * Записывает маппинг userId -> имя в JSON файл
 */
function writeNamesFile(mapping: Record<string, string>): void {
  try {
    writeFileSync(NAMES_FILE_PATH, JSON.stringify(mapping, null, 2), "utf-8");
  } catch (error) {
    // В serverless окружении файловая система может быть read-only
    // Логируем ошибку, но не прерываем выполнение
    console.warn(
      "Error writing user-names.json (file system may be read-only):",
      error
    );
  }
}

/**
 * Генерирует новое имя на основе базового имени с суффиксом
 */
function generateName(baseName: string, existingNames: Set<string>): string {
  let counter = 2;
  let newName = `${baseName}${counter}`;

  while (existingNames.has(newName)) {
    counter++;
    newName = `${baseName}${counter}`;
  }

  return newName;
}

/**
 * Присваивает уникальное имя пользователю или возвращает существующее
 * @param userId - ID пользователя
 * @param sessionCount - Количество сессий пользователя
 * @returns Имя пользователя или userId если sessionCount <= 1
 */
export function getOrAssignName(userId: string, sessionCount: number): string {
  // Не присваиваем имена пользователям с одной или менее сессией
  if (sessionCount <= 1) {
    return userId;
  }

  const mapping = readNamesFile();

  // Если имя уже присвоено, возвращаем его
  if (mapping[userId]) {
    return mapping[userId];
  }

  // Получаем список доступных имен и занятых имен
  const availableNames = getAvailableNames();
  const assignedNames = new Set(Object.values(mapping));

  // Ищем первое свободное имя из списка
  let assignedName: string | null = null;
  for (const name of availableNames) {
    if (!assignedNames.has(name)) {
      assignedName = name;
      break;
    }
  }

  // Если все имена заняты, генерируем новое на основе первого имени
  if (!assignedName) {
    const baseName = availableNames[0] || "Пилипич";
    assignedName = generateName(baseName, assignedNames);
  }

  // Сохраняем новое присвоение
  mapping[userId] = assignedName;
  writeNamesFile(mapping);

  return assignedName;
}

/**
 * Получает имя пользователя без присвоения нового
 */
export function getUserName(userId: string): string | null {
  const mapping = readNamesFile();
  return mapping[userId] || null;
}
