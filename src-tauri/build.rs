use std::env;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let native_build_dir = manifest_dir.join("../native/build");

    println!("cargo:rustc-link-search=native={}", native_build_dir.display());
    println!("cargo:rustc-link-lib=dylib=neural_bridge");
    println!("cargo:rustc-link-arg=-Wl,-rpath,@loader_path/../native/build");
    println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../native/build");
    println!("cargo:rustc-link-arg=-Wl,-rpath,@loader_path");
    println!("cargo:rerun-if-changed=../native/include/NeuralBridge.h");
}
