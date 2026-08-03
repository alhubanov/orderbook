use reqwest;

mod hash_table;

fn main() {
    let words = extract_words_from_txt_file("https://www.gutenberg.org/files/98/98-0.txt");

    let mut hash_table = hash_table::HashTable::new(140000);
    hash_table.insert(&words[0], 1);
    hash_table.insert(&words[1], 2);
    hash_table.insert(&words[2], -3);

    let value_test1 = hash_table.get(&words[0]);
    println!("{:?}", value_test1);

    let last_value = hash_table.get_last();
    let first_value = hash_table.get_first();

    println!("{:?}", last_value);
    println!("{:?}", first_value);

    hash_table.remove(&words[1]);
    let value_test3 = hash_table.get(&words[2]);

    println!("{:?}", value_test3);

    let value_test2 = hash_table.get(&words[1]);
    println!("{:?}", value_test2);
}

// TODO: add unit tests for word extraction
// TODO: add error handling
// TODO: reduce the amount of allocations

fn extract_words_from_txt_file(url: &str) -> Vec<String>
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

    words
}