#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include <cctype>
#include <cstdint>

#ifdef _WIN32
#include <windows.h>
#endif

#include <taglib/attachedpictureframe.h>
#include <taglib/fileref.h>
#include <taglib/flacfile.h>
#include <taglib/flacpicture.h>
#include <taglib/id3v2tag.h>
#include <taglib/mpegfile.h>
#include <taglib/mp4coverart.h>
#include <taglib/mp4file.h>
#include <taglib/mp4tag.h>
#include <taglib/oggfile.h>
#include <taglib/tbytevector.h>
#include <taglib/tpropertymap.h>
#include <taglib/unsynchronizedlyricsframe.h>
#include <taglib/vorbisfile.h>
#include <taglib/wavfile.h>
#include <taglib/xiphcomment.h>

namespace fs = std::filesystem;

namespace {

constexpr unsigned int kMaxCoverBytes = 8 * 1024 * 1024;

#ifdef _WIN32
std::string WideToUtf8(const std::wstring &value) {
  if (value.empty()) return "";
  const int size = WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) return "";
  std::string result(size, '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), size, nullptr, nullptr);
  return result;
}

std::wstring Utf8ToWide(const std::string &value) {
  if (value.empty()) return L"";
  const int size = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (size <= 0) return L"";
  std::wstring result(size, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), size);
  return result;
}
#endif

// 将文件路径转成 UTF-8 字符串 (Windows 底层是 UTF-16, Unix 本身就是 UTF-8)
std::string PathToUtf8(const fs::path &value) {
#ifdef _WIN32
  return WideToUtf8(value.wstring());
#else
  return value.string();
#endif
}

// 从 UTF-8 字符串构造文件路径
fs::path PathFromUtf8(const std::string &value) {
#ifdef _WIN32
  return fs::path(Utf8ToWide(value));
#else
  return fs::path(value);
#endif
}

std::string ToUtf8(const TagLib::String &value) {
  return value.to8Bit(true);
}

std::string Trim(const std::string &value) {
  const auto start = value.find_first_not_of(" \t\r\n");
  if (start == std::string::npos) return "";
  const auto end = value.find_last_not_of(" \t\r\n");
  return value.substr(start, end - start + 1);
}

std::string JsonEscape(const std::string &value) {
  std::ostringstream stream;
  for (const unsigned char ch : value) {
    switch (ch) {
      case '\"': stream << "\\\""; break;
      case '\\': stream << "\\\\"; break;
      case '\b': stream << "\\b"; break;
      case '\f': stream << "\\f"; break;
      case '\n': stream << "\\n"; break;
      case '\r': stream << "\\r"; break;
      case '\t': stream << "\\t"; break;
      default:
        if (ch < 0x20) {
          stream << "\\u";
          const char *hex = "0123456789abcdef";
          stream << "00" << hex[(ch >> 4) & 0x0F] << hex[ch & 0x0F];
        } else {
          stream << ch;
        }
    }
  }
  return stream.str();
}

std::string Q(const std::string &value) {
  return "\"" + JsonEscape(value) + "\"";
}

std::string DetectMimeType(const TagLib::ByteVector &data) {
  if (data.size() >= 4) {
    const auto *d = reinterpret_cast<const unsigned char *>(data.data());
    if (d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF) return "image/jpeg";
    if (d[0] == 0x89 && d[1] == 0x50 && d[2] == 0x4E && d[3] == 0x47) return "image/png";
    if (d[0] == 0x47 && d[1] == 0x49 && d[2] == 0x46 && d[3] == 0x38) return "image/gif";
    if (data.size() >= 12 && d[0] == 0x52 && d[1] == 0x49 && d[2] == 0x46 && d[3] == 0x46 &&
        d[8] == 0x57 && d[9] == 0x45 && d[10] == 0x42 && d[11] == 0x50) {
      return "image/webp";
    }
  }
  return "image/jpeg";
}

std::string CoverExtension(const std::string &mime) {
  if (mime == "image/png") return ".png";
  if (mime == "image/gif") return ".gif";
  if (mime == "image/webp") return ".webp";
  return ".jpg";
}

std::string HexHash(const std::string &value) {
  uint64_t hash = 1469598103934665603ull;
  for (const unsigned char ch : value) {
    hash ^= ch;
    hash *= 1099511628211ull;
  }
  std::ostringstream stream;
  stream << std::hex << std::setw(16) << std::setfill('0') << hash;
  return stream.str();
}

std::string WriteCoverFile(
    const TagLib::ByteVector &cover,
    const fs::path &filePath,
    const fs::path &artworkDir,
    const std::string &mime) {
  if (cover.isEmpty() || cover.size() > kMaxCoverBytes || artworkDir.empty()) return "";

  std::error_code ec;
  fs::create_directories(artworkDir, ec);
  if (ec) return "";

  const auto id = HexHash(PathToUtf8(filePath));
  const auto outPath = artworkDir / fs::path(id + CoverExtension(mime));
  std::ofstream out(outPath, std::ios::binary | std::ios::trunc);
  if (!out) return "";
  out.write(cover.data(), cover.size());
  if (!out) return "";
  return PathToUtf8(outPath);
}

std::string Base64Encode(const TagLib::ByteVector &data) {
  static constexpr char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string output;
  output.reserve(((data.size() + 2) / 3) * 4);

  const auto *bytes = reinterpret_cast<const unsigned char *>(data.data());
  for (unsigned int i = 0; i < data.size(); i += 3) {
    const unsigned int b0 = bytes[i];
    const unsigned int b1 = i + 1 < data.size() ? bytes[i + 1] : 0;
    const unsigned int b2 = i + 2 < data.size() ? bytes[i + 2] : 0;
    output.push_back(table[(b0 >> 2) & 0x3F]);
    output.push_back(table[((b0 & 0x03) << 4) | ((b1 >> 4) & 0x0F)]);
    output.push_back(i + 1 < data.size() ? table[((b1 & 0x0F) << 2) | ((b2 >> 6) & 0x03)] : '=');
    output.push_back(i + 2 < data.size() ? table[b2 & 0x3F] : '=');
  }
  return output;
}

std::string FormatDuration(int seconds) {
  if (seconds <= 0) return "00:00";
  const int minutes = seconds / 60;
  const int rest = seconds % 60;
  std::ostringstream stream;
  stream << minutes << ':';
  if (rest < 10) stream << '0';
  stream << rest;
  return stream.str();
}

std::string BuildQuality(TagLib::File *file, int bitrate, int sampleRate) {
  if (auto *flac = dynamic_cast<TagLib::FLAC::File *>(file)) {
    if (flac->audioProperties()) {
      std::ostringstream stream;
      stream << (sampleRate / 1000.0) << "kHz " << flac->audioProperties()->bitsPerSample() << "bit";
      return stream.str();
    }
  }

  if (auto *wav = dynamic_cast<TagLib::RIFF::WAV::File *>(file)) {
    if (wav->audioProperties()) {
      std::ostringstream stream;
      stream << (sampleRate / 1000.0) << "kHz " << wav->audioProperties()->bitsPerSample() << "bit";
      return stream.str();
    }
  }

  if (bitrate > 0) return std::to_string(bitrate) + "kbps";
  return "";
}

TagLib::ByteVector ReadCover(TagLib::File *file) {
  if (auto *mp3 = dynamic_cast<TagLib::MPEG::File *>(file)) {
    if (auto *id3 = mp3->ID3v2Tag()) {
      const auto frames = id3->frameList("APIC");
      if (!frames.isEmpty()) {
        if (auto *frame = dynamic_cast<TagLib::ID3v2::AttachedPictureFrame *>(frames.front())) return frame->picture();
      }
    }
  }

  if (auto *wav = dynamic_cast<TagLib::RIFF::WAV::File *>(file)) {
    if (auto *id3 = wav->ID3v2Tag()) {
      const auto frames = id3->frameList("APIC");
      if (!frames.isEmpty()) {
        if (auto *frame = dynamic_cast<TagLib::ID3v2::AttachedPictureFrame *>(frames.front())) return frame->picture();
      }
    }
  }

  if (auto *flac = dynamic_cast<TagLib::FLAC::File *>(file)) {
    const auto pictures = flac->pictureList();
    if (!pictures.isEmpty()) return pictures.front()->data();
  }

  if (auto *mp4 = dynamic_cast<TagLib::MP4::File *>(file)) {
    if (auto *tag = mp4->tag(); tag && tag->contains("covr")) {
      const auto covers = tag->item("covr").toCoverArtList();
      if (!covers.isEmpty()) return covers.front().data();
    }
  }

  if (auto *vorbis = dynamic_cast<TagLib::Ogg::Vorbis::File *>(file)) {
    if (auto *tag = vorbis->tag()) {
      const auto pictures = tag->pictureList();
      if (!pictures.isEmpty()) return pictures.front()->data();
    }
  }

  return {};
}

std::string FirstProperty(TagLib::File *file, const std::vector<std::string> &keys) {
  if (!file) return "";

  const auto properties = file->properties();
  for (const auto &rawKey : keys) {
    const TagLib::String key(rawKey, TagLib::String::UTF8);
    if (!properties.contains(key)) continue;
    const auto values = properties[key];
    if (!values.isEmpty()) {
      const auto text = Trim(ToUtf8(values.front()));
      if (!text.empty()) return text;
    }
  }
  return "";
}

std::string ReadLyrics(TagLib::File *file) {
  if (!file) return "";

  if (auto *mp3 = dynamic_cast<TagLib::MPEG::File *>(file)) {
    if (auto *id3 = mp3->ID3v2Tag()) {
      const auto frames = id3->frameList("USLT");
      for (auto *rawFrame : frames) {
        if (auto *frame = dynamic_cast<TagLib::ID3v2::UnsynchronizedLyricsFrame *>(rawFrame)) {
          const auto text = Trim(ToUtf8(frame->text()));
          if (!text.empty()) return text;
        }
      }
    }
  }

  if (auto *wav = dynamic_cast<TagLib::RIFF::WAV::File *>(file)) {
    if (auto *id3 = wav->ID3v2Tag()) {
      const auto frames = id3->frameList("USLT");
      for (auto *rawFrame : frames) {
        if (auto *frame = dynamic_cast<TagLib::ID3v2::UnsynchronizedLyricsFrame *>(rawFrame)) {
          const auto text = Trim(ToUtf8(frame->text()));
          if (!text.empty()) return text;
        }
      }
    }
  }

  return FirstProperty(file, {
    "LYRICS",
    "UNSYNCEDLYRICS",
    "UNSYNCHRONIZEDLYRICS",
  });
}

bool IsAudioPath(const fs::path &file) {
  std::string ext = file.extension().string();
  for (auto &ch : ext) ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
  return ext == ".mp3" || ext == ".flac" || ext == ".m4a" || ext == ".mp4" ||
         ext == ".aac" || ext == ".ogg" || ext == ".opus" || ext == ".wav" ||
         ext == ".aiff" || ext == ".aif" || ext == ".ape" || ext == ".wv";
}

TagLib::FileRef OpenFileRef(const fs::path &filePath) {
#ifdef _WIN32
  return TagLib::FileRef(TagLib::FileName(filePath.wstring().c_str()), true, TagLib::AudioProperties::Average);
#else
  return TagLib::FileRef(TagLib::FileName(filePath.c_str()), true, TagLib::AudioProperties::Average);
#endif
}

std::string ReadFileJson(const fs::path &filePath, const fs::path &artworkDir = {}) {
  TagLib::FileRef fileRef = OpenFileRef(filePath);
  if (fileRef.isNull() || !fileRef.file()) {
    throw std::runtime_error("Unsupported or unreadable audio file");
  }

  auto *tag = fileRef.tag();
  auto *file = fileRef.file();
  auto *props = fileRef.audioProperties();
  const int seconds = props ? props->lengthInSeconds() : 0;
  const int bitrate = props ? props->bitrate() : 0;
  const int sampleRate = props ? props->sampleRate() : 0;
  const int channels = props ? props->channels() : 0;
  const auto cover = ReadCover(file);
  const bool includeCover = !cover.isEmpty() && cover.size() <= kMaxCoverBytes;
  const auto mime = includeCover ? DetectMimeType(cover) : "";
  const auto coverPath = includeCover ? WriteCoverFile(cover, filePath, artworkDir, mime) : "";
  const auto lyric = ReadLyrics(file);

  std::ostringstream json;
  json << "{";
  json << "\"path\":" << Q(PathToUtf8(filePath)) << ",";
  json << "\"title\":" << Q(tag ? ToUtf8(tag->title()) : "") << ",";
  json << "\"artist\":" << Q(tag ? ToUtf8(tag->artist()) : "") << ",";
  json << "\"album\":" << Q(tag ? ToUtf8(tag->album()) : "") << ",";
  json << "\"comment\":" << Q(tag ? ToUtf8(tag->comment()) : "") << ",";
  json << "\"genre\":" << Q(tag ? ToUtf8(tag->genre()) : "") << ",";
  json << "\"year\":" << (tag ? tag->year() : 0) << ",";
  json << "\"track\":" << (tag ? tag->track() : 0) << ",";
  json << "\"durationSeconds\":" << seconds << ",";
  json << "\"duration\":" << Q(FormatDuration(seconds)) << ",";
  json << "\"bitrate\":" << bitrate << ",";
  json << "\"sampleRate\":" << sampleRate << ",";
  json << "\"channels\":" << channels << ",";
  json << "\"quality\":" << Q(BuildQuality(file, bitrate, sampleRate)) << ",";
  json << "\"coverMime\":" << Q(mime) << ",";
  json << "\"coverPath\":" << Q(coverPath) << ",";
  json << "\"coverDataUrl\":" << Q("") << ",";
  json << "\"lyric\":" << Q(lyric);
  json << "}";
  return json.str();
}

std::vector<fs::path> CollectAudioFiles(const std::vector<fs::path> &roots) {
  std::vector<fs::path> files;
  for (const auto &root : roots) {
    std::error_code ec;
    if (!fs::exists(root, ec) || !fs::is_directory(root, ec)) continue;
    fs::recursive_directory_iterator it(root, fs::directory_options::skip_permission_denied, ec);
    fs::recursive_directory_iterator end;
    while (it != end) {
      if (!ec && it->is_regular_file(ec) && IsAudioPath(it->path())) files.push_back(it->path());
      it.increment(ec);
    }
  }
  return files;
}

int run(const std::vector<std::string> &args) {
  if (args.size() < 3) {
    std::cerr << "Usage: taglib_reader_cli read <file> | scan [--artwork-dir <dir>] <dir...>\n";
    return 2;
  }

  try {
    const std::string mode = args[1];
    if (mode == "read") {
      std::cout << ReadFileJson(PathFromUtf8(args[2]));
      return 0;
    }

    if (mode == "scan") {
      fs::path artworkDir;
      std::vector<fs::path> roots;
      int startIndex = 2;
      if (args.size() >= 5 && args[2] == "--artwork-dir") {
        artworkDir = PathFromUtf8(args[3]);
        startIndex = 4;
      }
      for (size_t i = static_cast<size_t>(startIndex); i < args.size(); i++) roots.emplace_back(PathFromUtf8(args[i]));
      const auto files = CollectAudioFiles(roots);

      std::cout << "{\"songs\":[";
      bool first = true;
      for (const auto &file : files) {
        try {
          if (!first) std::cout << ",";
          std::cout << ReadFileJson(file, artworkDir);
          first = false;
        } catch (const std::exception &error) {
          std::cerr << "Failed to read " << PathToUtf8(file) << ": " << error.what() << "\n";
        }
      }
      std::cout << "]}";
      return 0;
    }

    std::cerr << "Unknown mode\n";
    return 2;
  } catch (const std::exception &error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}

}  // namespace

#ifdef _WIN32
int wmain(int argc, wchar_t **argv) {
  SetConsoleOutputCP(CP_UTF8);
  std::vector<std::string> args;
  args.reserve(static_cast<size_t>(argc));
  for (int i = 0; i < argc; i++) args.push_back(WideToUtf8(argv[i]));
  return run(args);
}
#else
int main(int argc, char **argv) {
  std::vector<std::string> args;
  args.reserve(static_cast<size_t>(argc));
  for (int i = 0; i < argc; i++) args.push_back(argv[i]);
  return run(args);
}
#endif
