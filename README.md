# Hash table + Orderbook
A hash table implementation in Rust + an orderbook visualization

## Hash table

The first thing I did was to write a scaffolding for the hash table and add its empty methods there to be implemented. Then, the first function I implemented was the function to parse the text from the book. I am not aware of a way to split a string via more than one character at once, so I implemented it by first splitting in lines and then splitting each line into words and flattening. 

For the hash table, I started with a simple approach. I did not initially worry about the O(1) requirement. I implemented it using two arrays - one for keys and one for values - fixing the size via a constant. For the get_last() and get_first() functions, I relied on a VecDeque, thereby working in O(n). I created a really simple hash() that sums up the ASCII values of characters modulo capacity of the table. This gave me a first version. 

The linear probing entailed adding a helper function called hash_with_probe(), where I apply the my simple hash() and then run through subsequent entries until I find a suitable position to place the entry. The public functions insert(), remove() and get() all make use of hash_with_probe(). For removal, I make sure that when an entry is removed, all existing subsequent entries in the arrays storing the keys and the values are moved one or more indices forward, if they have been placed further back than their hashes would indicate because of probing during insertion. This is necessary because otherwise, subsequent calls to get() for these keys would wrongly indicate that their values are not present.

Then, in one commit, I added unit tests and I switched from using arrays to using vectors. The idea was that the user should be able to set the capacity of the hash table. The hash table would still remain fixed-size, as after creation, it would never be resized, and its capacity would never change. Ability to set capacity was also helpful for the unit tests, where I could set a small capacity. In the main() function, I would still set a large capacity (~140000) as that was the total number of words collected from the Gutenberg text.

Then, I continued to actually cover the requirement of O(1) complexity for get_last() and get_first(). To do this, one needs to detach the hashing logic from the storage of the key-value pairs. The reason for this is because the vector of key-values cannot at the same time keep a relative order of when they were placed AND be placed correspoding to their hash after probing. Indeed, I tried to do both by forcing each key-value pair to keep a prev and next pointer to other pairs and I still placed key-value pairs in the position dictated by their hash but this breaks down as soon as you try to call remove(). You'd have to accommodate for linear probing by moving pairs forward in place and then do an O(n) pass to adjust all newly mistaken prev/next pointer values. 

By detaching the hashing logic, one does not encounter that problem. I kept a separate vector call 'hash_storage' with the same capacity strictly for keeping track of hashing. When inserting, I hash the key, then at the position corresponding to the hash in 'hash_storage', I store the index in the key-value pairs vector where I would actually place the new entry in the table. This index is not governed by hashing, it's just the next available one to place an entry in. By doing this, by keeping the prev/next pointers per entry, and by adding a last_updated_idx and first_updated_idx fields in the hash table struct, I can achieve O(1) for all functions. When adding or removing an entry, I keep the relative order by adjusting the prev/next pointers in its neighbors, exactly like a linked list would do, while simultaneously conducting the linear probing in the separate hash_storage vector.

There remains one problem though. To place a new entry, as I pointed out above, I just get the "next available index" in the vector with entries. The simplest way to do that is to just keep a counter with the highest-value index, not yet occupied in the vector. But, if you also remove entries, this is not optimal because you leave a lot of "holes" in the vector that you never come back to fill with a new insertion. To solve this, I added a "free list" to the hash table struct, where I push indices of removed key-value pair entries, thereby marking them as reusable. When inserting a new entry afterwards, I first check if there is an index I can utilize from the free list, before defaulting to the next free entry as indicated by the counter.

With this, the implementation covers the requirements. Some things can be optimized further. It is not strictly necessary to derive the Debug trait for the Entry struct. Regarding text parsing, the function can likely be made more efficient by making less allocations and avoiding requiring flattening if possible. That function needs to also be further tested to see if it splits correctly all words and excludes all punctuation.

## Orderbook

To build the orderbook, I used Claude Code in VS Code using Claude Opus 5. I instructed it to utilize React as a framework. I instructed it to create only the orderbook first using the binance page as a reference. I told it to feature 20 levels for bid and for ask. It built it correctly using React + Vite. It used the live data from the binance API endpoints. Then, I instructed it to add a chart and it did so using the trading view library. 

A dev version can be run like so:

```bash
npm install
npm run dev
```

and usually accessible under localhost:5173. It is also hosted at [https://alhubanov.github.io/orderbook/](https://alhubanov.github.io/orderbook/) via Github Pages. It is suitable on the web for desktop and mobile. 

