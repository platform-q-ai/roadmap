#!/bin/bash

# ============================================
# Code Quality Check Script
# ============================================
# Blocks commits containing incomplete code, placeholders, or violations.
# All checks are errors - no warnings allowed.
#
# Checks performed:
# 1a-d: Incomplete work markers (TODO, FIXME, placeholder, test code, .only/.skip)
# 2a-f: Type safety and lint bypasses (as any, @ts-ignore, eslint-disable, console.log)
# 3a-b: Barrel exports exist for all layers and subdirectories
# 4: Clean Architecture boundary violations (no infrastructure imports in domain/use-cases)
# 5: Dead code detection (unused source files)
# 6: CLAUDE.md and AGENTS.md are identical

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Code Quality Check                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS_FOUND=0

EXCLUDE_ARGS="--exclude=check-code-quality.sh --exclude=*.md --exclude=*.json --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=coverage --exclude-dir=reports --exclude-dir=web --exclude-dir=db"

# Helper: Check for word-bounded patterns
check_pattern() {
  local pattern="$1"
  local search_dir="$2"
  local description="$3"

  local results
  results=$(grep -rniE $EXCLUDE_ARGS "\b${pattern}\b" "$search_dir" 2>/dev/null || true)

  if [ -n "$results" ]; then
    echo -e "${RED}❌ Found '${pattern}' in ${description}:${NC}"
    echo "$results" | head -5
    local count
    count=$(echo "$results" | wc -l | tr -d ' ')
    if [ "$count" -gt 5 ]; then
      echo -e "${YELLOW}   ... and $(($count - 5)) more occurrences${NC}"
    fi
    echo ""
    ERRORS_FOUND=1
  fi
}

# Helper: Check for literal patterns
check_literal() {
  local pattern="$1"
  local search_dir="$2"
  local description="$3"

  local results
  results=$(grep -rniE $EXCLUDE_ARGS "${pattern}" "$search_dir" 2>/dev/null || true)

  if [ -n "$results" ]; then
    echo -e "${RED}❌ Found '${pattern}' in ${description}:${NC}"
    echo "$results" | head -5
    local count
    count=$(echo "$results" | wc -l | tr -d ' ')
    if [ "$count" -gt 5 ]; then
      echo -e "${YELLOW}   ... and $(($count - 5)) more occurrences${NC}"
    fi
    echo ""
    ERRORS_FOUND=1
  fi
}

# ============================================
# CHECK 1: Incomplete Work Markers
# ============================================

echo -e "${YELLOW}📁 CHECK 1: Incomplete work markers...${NC}"
echo ""

# 1a: TODO/FIXME/HACK markers in source
for pattern in TODO FIXME XXX HACK BUG; do
  check_pattern "$pattern" "src" "source files"
done

# 1b: Placeholder text
check_pattern "not implemented" "src" "source files"
check_pattern "implement this" "src" "source files"
check_pattern "placeholder" "src" "source files"

# 1c: Test code in production (standalone words)
for pattern in mock fake dummy stub; do
  check_pattern "$pattern" "src" "production code"
done

# 1c-2: Test doubles with camelCase naming (MockService, FakeRepository, etc.)
for prefix in Mock Fake Dummy Stub; do
  CAMEL_CASE=$(grep -rnE $EXCLUDE_ARGS "${prefix}[A-Z][a-zA-Z]*" src 2>/dev/null || true)
  if [ -n "$CAMEL_CASE" ]; then
    echo -e "${RED}❌ Found test double in production code (${prefix}*):${NC}"
    echo "$CAMEL_CASE" | head -5
    count=$(echo "$CAMEL_CASE" | wc -l | tr -d ' ')
    if [ "$count" -gt 5 ]; then
      echo -e "${YELLOW}   ... and $(($count - 5)) more occurrences${NC}"
    fi
    echo ""
    ERRORS_FOUND=1
  fi
done

# 1d: Focused/skipped tests in production
check_literal "\.only\(" "src" "production code"
check_literal "\.skip\(" "src" "production code"

# ============================================
# CHECK 2: Type Safety and Lint Bypasses
# ============================================

echo -e "${YELLOW}🔒 CHECK 2: Type safety and lint bypasses...${NC}"
echo ""

# 2a: Type safety bypasses
check_literal "as any" "src" "source files"

# 2b: TypeScript suppressions
check_literal "@ts-ignore" "src" "source files"
check_literal "@ts-expect-error" "src" "source files"

# 2c: Linting bypasses (allow specific ones in CLI adapters)
ESLINT_DISABLE=$(grep -rniE $EXCLUDE_ARGS "eslint-disable" src 2>/dev/null | grep -v "eslint-disable-next-line no-console" || true)
if [ -n "$ESLINT_DISABLE" ]; then
  echo -e "${RED}❌ Found eslint-disable in source files (only eslint-disable-next-line no-console allowed in CLI adapters):${NC}"
  echo "$ESLINT_DISABLE" | head -5
  echo ""
  ERRORS_FOUND=1
fi

# 2d: TODO in tests
for pattern in TODO FIXME XXX HACK; do
  check_pattern "$pattern" "tests" "test files"
done

# 2e: Stub implementations
THROW_NOT_IMPL=$(grep -rniE $EXCLUDE_ARGS "throw new Error.*not.*implement" src tests 2>/dev/null || true)
if [ -n "$THROW_NOT_IMPL" ]; then
  echo -e "${RED}❌ Found stub implementations (throw new Error not implemented):${NC}"
  echo "$THROW_NOT_IMPL"
  echo ""
  ERRORS_FOUND=1
fi

# 2f: Console.log in source (allow in CLI adapters which are entry points)
CONSOLE_LOG=$(grep -rniE $EXCLUDE_ARGS "console\.log\(" src 2>/dev/null | grep -v "src/adapters/cli/" || true)
if [ -n "$CONSOLE_LOG" ]; then
  echo -e "${RED}❌ Found console.log (use console.error or a proper logger):${NC}"
  echo "$CONSOLE_LOG"
  echo ""
  ERRORS_FOUND=1
fi

# ============================================
# CHECK 3: Barrel Exports
# ============================================

echo -e "${YELLOW}📦 CHECK 3: Barrel exports...${NC}"
echo ""

for layer in domain use-cases infrastructure; do
  if [ -d "src/${layer}" ]; then
    if [ ! -f "src/${layer}/index.ts" ]; then
      echo -e "${RED}❌ Missing barrel export: src/${layer}/index.ts${NC}"
      echo "   Each layer must have an index.ts that exports its public API"
      ERRORS_FOUND=1
    else
      echo -e "${GREEN}✓ Found src/${layer}/index.ts${NC}"
    fi
  fi
done

# 3b: Check subdirectories have barrel exports
echo ""
echo "Checking subdirectory barrel exports..."
for layer in domain; do
  if [ -d "src/${layer}" ]; then
    for subdir in src/${layer}/*/; do
      if [ -d "$subdir" ]; then
        ts_count=$(find "$subdir" -maxdepth 1 -name "*.ts" ! -name "index.ts" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$ts_count" -gt 0 ]; then
          if [ ! -f "${subdir}index.ts" ]; then
            echo -e "${RED}❌ Missing barrel export: ${subdir}index.ts${NC}"
            echo "   Subdirectory has $ts_count .ts files but no index.ts"
            ERRORS_FOUND=1
          fi
        fi
      fi
    done
  fi
done

# ============================================
# CHECK 4: Clean Architecture Boundaries
# ============================================

echo ""
echo -e "${YELLOW}🏗️  CHECK 4: Clean Architecture boundaries...${NC}"
echo ""

# Domain must not import from use-cases, infrastructure, or adapters
DOMAIN_VIOLATION=$(grep -rnE "from.*['\"].*/(use-cases|infrastructure|adapters)/" src/domain 2>/dev/null || true)
if [ -n "$DOMAIN_VIOLATION" ]; then
  echo -e "${RED}❌ Domain layer imports from outer layers:${NC}"
  echo "$DOMAIN_VIOLATION"
  echo ""
  ERRORS_FOUND=1
else
  echo -e "${GREEN}✓ Domain layer has no outward dependencies${NC}"
fi

# Use-cases must not import from infrastructure or adapters
UC_VIOLATION=$(grep -rnE "from.*['\"].*/(infrastructure|adapters)/" src/use-cases 2>/dev/null || true)
if [ -n "$UC_VIOLATION" ]; then
  echo -e "${RED}❌ Use-cases layer imports from infrastructure or adapters:${NC}"
  echo "$UC_VIOLATION"
  echo ""
  ERRORS_FOUND=1
else
  echo -e "${GREEN}✓ Use-cases layer depends only on domain${NC}"
fi

# Infrastructure must not import from adapters
INFRA_VIOLATION=$(grep -rnE "from.*['\"].*/(adapters)/" src/infrastructure 2>/dev/null || true)
if [ -n "$INFRA_VIOLATION" ]; then
  echo -e "${RED}❌ Infrastructure layer imports from adapters:${NC}"
  echo "$INFRA_VIOLATION"
  echo ""
  ERRORS_FOUND=1
else
  echo -e "${GREEN}✓ Infrastructure layer has correct dependencies${NC}"
fi

# ============================================
# CHECK 5: Dead Code Detection
# ============================================

echo ""
echo -e "${YELLOW}🧹 CHECK 5: Dead code detection...${NC}"
echo ""

if command -v npx &> /dev/null; then
  echo "Checking for potentially unused source files..."

  DEAD_FILES=""
  for file in $(find src -name "*.ts" ! -name "index.ts" ! -name "*.test.ts" ! -name "*.d.ts" ! -path "src/adapters/cli/*" 2>/dev/null); do
    filename=$(basename "$file" .ts)
    if [ "$filename" = "index" ]; then
      continue
    fi

    IMPORT_COUNT=$(grep -rl "from.*['\"].*${filename}['\"]" src --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$IMPORT_COUNT" -eq 0 ]; then
      dir=$(dirname "$file")
      if [ -f "${dir}/index.ts" ]; then
        if grep -q "$filename" "${dir}/index.ts" 2>/dev/null; then
          continue
        fi
      fi

      TEST_IMPORT_COUNT=$(grep -rl "from.*['\"].*${filename}['\"]" tests --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$TEST_IMPORT_COUNT" -gt 0 ]; then
        continue
      fi

      DEAD_FILES="${DEAD_FILES}  ${file}\n"
    fi
  done

  if [ -n "$DEAD_FILES" ]; then
    echo -e "${YELLOW}⚠ Potentially unused source files (not imported in src or tests):${NC}"
    echo -e "$DEAD_FILES"
    echo "   These files may be dead code or missing from barrel exports"
  else
    echo -e "${GREEN}✓ All source files appear to be in use${NC}"
  fi
fi

# ============================================
# CHECK 6: CLAUDE.md and AGENTS.md identical
# ============================================

echo ""
echo -e "${YELLOW}📖 CHECK 6: Documentation files...${NC}"
echo ""

if [ -f "CLAUDE.md" ] && [ -f "AGENTS.md" ]; then
  if ! diff -q CLAUDE.md AGENTS.md > /dev/null 2>&1; then
    echo -e "${RED}❌ CLAUDE.md and AGENTS.md are not identical. Keep them in sync.${NC}"
    ERRORS_FOUND=1
  else
    echo -e "${GREEN}✓ CLAUDE.md and AGENTS.md are identical${NC}"
  fi
elif [ -f "AGENTS.md" ]; then
  echo -e "${GREEN}✓ AGENTS.md exists${NC}"
fi

# ============================================
# SUMMARY
# ============================================

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $ERRORS_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ All code quality checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Code quality check failed!${NC}"
  echo "Please resolve the issues above before committing."
  exit 1
fi
