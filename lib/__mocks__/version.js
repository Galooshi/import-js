import packageJson from '../../package.json';

let versionString;

export default function version() {
  return versionString;
}

version.__setVersion = function __setVersion(newVersion) {
  versionString = newVersion;
};

version.__reset = function __reset() {
  versionString = packageJson.version;
};
version.__reset();
