#!/usr/bin/env bash
# 在 Linux / macOS 上编译 taglib_reader_cli (本地音乐标签扫描器)
# 依赖: g++ (C++17), TagLib (pkg-config 或手动指定 TAGLIB_PREFIX)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
outDir="$root/build"
mkdir -p "$outDir"

cliSrc="$root/taglib_reader_cli.cpp"
cliOut="$outDir/taglib_reader_cli"

if command -v pkg-config >/dev/null 2>&1 && pkg-config --exists taglib; then
    # Source headers use <taglib/...>; pkg-config often returns only include/taglib.
    taglib_cflags="-I$(pkg-config --variable=includedir taglib) $(pkg-config --cflags taglib)"
    taglib_libs="$(pkg-config --libs taglib)"
else
    TAGLIB_PREFIX="${TAGLIB_PREFIX:-/usr/local}"
    taglib_cflags="-I${TAGLIB_PREFIX}/include"
    taglib_libs="-L${TAGLIB_PREFIX}/lib -ltag"
fi

# 注意: taglib 依赖 zlib (静态链接时尤其需要显式 -lz)
g++ -std=c++17 -O2 -fPIC ${taglib_cflags} "$cliSrc" -o "$cliOut" ${taglib_libs} -lz

if [[ "$(uname -s)" == "Darwin" ]]; then
    # Copy Homebrew dylibs and rewrite install names recursively. The packaged scanner
    # must work on Macs without Homebrew (including paths containing spaces).
    if ! command -v dylibbundler >/dev/null 2>&1; then
        echo 'macOS requires dylibbundler: brew install dylibbundler' >&2
        exit 1
    fi
    rm -rf "$outDir/lib"
    dylibbundler -od -b -x "$cliOut" -d "$outDir/lib" -p '@executable_path/lib/'
    # Re-sign after changing Mach-O load commands; needed on Apple Silicon.
    if [[ -d "$outDir/lib" ]]; then
        find "$outDir/lib" -type f -name '*.dylib' -exec codesign --force --sign - {} \;
    fi
    codesign --force --sign - "$cliOut"
fi

echo "Built $cliOut"
