use reqwest;

// mod hash_table;

pub fn run() -> () {
    extract_words_from_txt_file("https://www.gutenberg.org/files/98/98-0.txt");
}

fn extract_words_from_txt_file(url: &str) -> ()
{
    let response_body = reqwest::blocking::get(url).expect("Get request failed.");
    let text_content = response_body.text().expect("Coundn't extract words from response body.");
    let words : Vec<String> = text_content
                                .lines()
                                .map(|line| line.replace(&['(', ')', ',', '.', ';', ':', '\"', '“', '”', '’', '‘', '*', '!', '?'], ""))
                                .filter(|line_string| !line_string.is_empty())
                                .map(|line| line
                                        .trim()
                                        .to_string())
                                .map(|line| line
                                        .split(" ")
                                        .map(|string| string.to_owned())
                                        .collect::<Vec<String>>())
                                .flatten()
                                .collect();

    println!("{:?}", words);
}