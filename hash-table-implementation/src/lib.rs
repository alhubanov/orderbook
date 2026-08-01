use reqwest;

// mod hash_table;

pub fn run() -> () {
    extract_words_from_txt_file("https://www.gutenberg.org/files/98/98-0.txt");
}

// TODO: add unit tests for word extraction
// TODO: add error handling
// TODO: reduce the amount of allocations
// TODO: determine how to remove the apostrophe character (') correctly.

fn extract_words_from_txt_file(url: &str) -> Vec<String> // I am assuming I am not allowed to use a hash set from the standard library.
{
    let response_body = reqwest::blocking::get(url).expect("Get request failed.");
    let text_content = response_body.text().expect("Couldn't extract words from response body.");
    let words : Vec<String> = text_content
                                .replace(&['(', ')', ',', '.', ';', ':', '\"', '“', '”', '’', '‘', '*', '!', '?'], "")
                                .lines()
                                .map(|line| line
                                        .replace("--", " --")
                                        .replace("--", "")
                                        .split(" ")
                                        .map(|string| string.to_owned())
                                        .collect::<Vec<String>>())
                                .flatten()
                                .filter(|word| !word.is_empty())
                                .collect();

    println!("{:?}", words);

    words
}